import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ─── tiny helper components ─────────────────────── */
const Badge = ({ children, color = 'indigo' }) => {
  const map = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-950/20',
    green:  'text-emerald-400 border-emerald-500/20 bg-emerald-950/20',
    red:    'text-red-400 border-red-500/20 bg-red-950/20',
    amber:  'text-amber-400 border-amber-500/20 bg-amber-950/20',
    violet: 'text-violet-400 border-violet-500/20 bg-violet-950/20',
    cyan:   'text-cyan-400 border-cyan-500/20 bg-cyan-950/20',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border tracking-wide ${map[color] || 'text-zinc-400 border-zinc-800 bg-zinc-900/40'}`}>
      {children}
    </span>
  );
};

const Dot = ({ on, pulse }) => (
  <span className={`inline-block w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-rose-500'} ${pulse ? 'animate-pulse' : ''}`} />
);

const SectionTitle = ({ children, accent }) => (
  <div className="flex items-center gap-1.5 mb-2.5">
    {accent && <span className="w-0.5 h-3 rounded bg-zinc-400 inline-block" />}
    <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{children}</h3>
  </div>
);

const MetricBox = ({ label, value, color = 'text-zinc-100' }) => (
  <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-lg p-3">
    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
    <p className={`text-lg font-light mono tracking-tight ${color}`}>{value}</p>
  </div>
);

/* ─── main component ──────────────────────────────── */
export default function App() {
  const presets = [
    { id: 'balanced', name: 'Balanced',   limit: 10, windowSec: 30, isAuto: true,  desc: 'Standard limits.' },
    { id: 'strict',   name: 'Strict',     limit: 3,  windowSec: 15, isAuto: false, refillRate: 0.1, leakRate: 0.1, desc: 'Tight limits, slow refill.' },
    { id: 'ddos',     name: 'DDoS Test',  limit: 5,  windowSec: 10, isAuto: false, refillRate: 0.2, leakRate: 0.2, desc: 'Extreme simulation.' },
  ];

  const [activePreset, setActivePreset]         = useState('balanced');
  const [algorithm, setAlgorithm]               = useState('token_bucket');
  const [limit, setLimit]                       = useState(10);
  const [windowSec, setWindowSec]               = useState(30);
  const [isAutoRates, setIsAutoRates]           = useState(true);
  const [customRefillRate, setCustomRefillRate] = useState(0.33);
  const [customLeakRate, setCustomLeakRate]     = useState(0.33);

  // capacity always mirrors limit — no async useEffect needed
  const capacity = limit;

  const [response, setResponse]   = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [isRedis, setIsRedis]     = useState(false);
  const [simulateRedis]           = useState(false);
  const [serverState, setServerState] = useState(null);
  const [stats, setStats]         = useState({ total: 0, success: 0, blocked: 0 });
  const [logs, setLogs]           = useState([]);
  const [spamRps, setSpamRps]     = useState(3);
  const [isSpamming, setIsSpamming] = useState(false);
  const [showSpammer, setShowSpammer] = useState(false);
  const spamIntervalRef           = useRef(null);
  const triggerRequestRef         = useRef(null);

  const [simulatedTokens, setSimulatedTokens] = useState(10);
  const [simulatedWater, setSimulatedWater]   = useState(0);
  const [windowResetTime, setWindowResetTime] = useState(30);
  const [slidingNodes, setSlidingNodes]       = useState([]);
  const serverStateRef = useRef(null);

  const [chartData, setChartData]   = useState([]);
  const chartAccumRef               = useRef({});

  const [redisMetrics, setRedisMetrics] = useState(null);
  const [redisConfig, setRedisConfig]   = useState(null);
  const [redisHost, setRedisHost]       = useState('127.0.0.1');
  const [redisPort, setRedisPort]       = useState(6379);
  const [redisPassword, setRedisPassword] = useState('');
  const [redisConnecting, setRedisConnecting] = useState(false);

  const [apiKeys, setApiKeys]         = useState([]);
  const [newKeyName, setNewKeyName]   = useState('');
  const [newKeyTier, setNewKeyTier]   = useState('free');
  const [activeApiKey, setActiveApiKey] = useState(null);
  const [showKeyCopied, setShowKeyCopied] = useState(null);

  const [authMode, setAuthMode]       = useState('sandbox');
  const [jwtToken, setJwtToken]       = useState(null);
  const [jwtUser, setJwtUser]         = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [authError, setAuthError]     = useState(null);

  const [ddosStatus, setDdosStatus]   = useState(null);

  /* left panel active tab */
  const [leftTab, setLeftTab] = useState('algo'); // algo | auth | config | redis | keys | ddos

  /* ── presets ─────────────────────────────────── */
  const applyPreset = (p) => {
    setActivePreset(p.id);
    setLimit(p.limit);
    setWindowSec(p.windowSec);
    setIsAutoRates(p.isAuto);
    if (!p.isAuto) { setCustomRefillRate(p.refillRate); setCustomLeakRate(p.leakRate); }
  };

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(d => setIsRedis(d.rateLimiterMode)).catch(() => {});
  }, []);

  // Reset visual state when algorithm switches so stale meta doesn't bleed over
  useEffect(() => {
    setServerState(null);
    setSimulatedTokens(limit);
    setSimulatedWater(0);
    setSlidingNodes([]);
  }, [algorithm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset visual state when rate config changes so visualization reflects new limits
  useEffect(() => {
    setServerState(null);
    setSimulatedTokens(limit);
    setSimulatedWater(0);
  }, [limit, windowSec]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRefillRateMs = isAutoRates ? (capacity / (windowSec * 1000)) : (customRefillRate / 1000);
  const activeLeakRateMs   = isAutoRates ? (capacity / (windowSec * 1000)) : (customLeakRate   / 1000);

  /* ── live visual sim ─────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => {
      const now   = Date.now();
      const state = serverStateRef.current;
      if (algorithm === 'token_bucket' && state) {
        const el = now - state.lastUpdated;
        setSimulatedTokens(Math.min(capacity, state.tokens + (el > 0 ? el * activeRefillRateMs : 0)));
      } else if (algorithm === 'leaky_bucket' && state) {
        const el = now - state.lastUpdated;
        setSimulatedWater(Math.max(0, state.water - (el > 0 ? el * activeLeakRateMs : 0)));
      } else if (algorithm === 'fixed_window') {
        setWindowResetTime(windowSec - (Math.floor(now / 1000) % windowSec));
      } else if (algorithm === 'sliding_window' && state?.log) {
        setSlidingNodes(state.log.filter(i => now - i.timestamp < windowSec * 1000));
      }
    }, 50);
    return () => clearInterval(t);
  }, [algorithm, capacity, windowSec, activeRefillRateMs, activeLeakRateMs]);

  /* ── chart ───────────────────────────────────── */
  const addChartPoint = (success) => {
    const sec   = new Date().toLocaleTimeString();
    const accum = chartAccumRef.current;
    if (!accum[sec]) accum[sec] = { time: sec, success: 0, blocked: 0 };
    accum[sec][success ? 'success' : 'blocked']++;
    setChartData([...Object.values(accum).slice(-30)]);
  };

  /* ── core request ────────────────────────────── */
  const triggerRequest = async (path = '/api/data') => {
    setLoading(true);
    setError(null);
    setResponse(null);
    const headers = {
      'Content-Type': 'application/json',
      'X-Limiter-Algo':       algorithm,
      'X-Limiter-Limit':      limit.toString(),
      'X-Limiter-Window':     windowSec.toString(),
      'X-Limiter-Capacity':   capacity.toString(),
      'X-Limiter-Refill-Rate': activeRefillRateMs.toString(),
      'X-Limiter-Leak-Rate':   activeLeakRateMs.toString(),
      'X-Auth-Mode':          authMode,
      'X-Simulate-Redis':     simulateRedis ? 'true' : 'false',
      ...(authMode === 'user'   && jwtToken    ? { 'Authorization': `Bearer ${jwtToken}` } : {}),
      ...(authMode === 'apikey' && activeApiKey ? { 'X-API-Key': activeApiKey } : {}),
      ...(authMode === 'sandbox'&& activeApiKey ? { 'X-API-Key': activeApiKey } : {}),
    };
    try {
      const res  = await fetch(path, { headers });
      const data = await res.json();
      const ok   = res.status === 200;
      setIsRedis(data.isRedis);
      addChartPoint(ok);
      setStats(prev => ({ total: prev.total + 1, success: prev.success + (ok ? 1 : 0), blocked: prev.blocked + (ok ? 0 : 1) }));
      setLogs(prev => [{ id: Math.random().toString(36).substr(2,9), time: new Date().toLocaleTimeString(), method: 'GET', path, status: res.status, remaining: data.remaining ?? null, mode: data.isRedis ? 'Redis' : 'Memory' }, ...prev].slice(0, 100));
      if (!ok) { setError(data); if (data.meta) setServerState(data.meta); }
      else     { setResponse(data); if (data.rateLimit?.meta) setServerState(data.rateLimit.meta); }
    } catch (err) {
      setLogs(prev => [{ id: Math.random().toString(36).substr(2,9), time: new Date().toLocaleTimeString(), method: 'GET', path, status: 'ERR', remaining: 0, mode: '—' }, ...prev]);
      setError({ message: 'Server connection failed', error: err.message });
    } finally { setLoading(false); }
  };

  triggerRequestRef.current = triggerRequest;
  serverStateRef.current    = serverState;

  /* ── spam ────────────────────────────────────── */
  useEffect(() => {
    if (isSpamming) spamIntervalRef.current = setInterval(() => triggerRequestRef.current('/api/data'), 1000 / spamRps);
    else if (spamIntervalRef.current) clearInterval(spamIntervalRef.current);
    return () => { if (spamIntervalRef.current) clearInterval(spamIntervalRef.current); };
  }, [isSpamming, spamRps]);

  /* ── redis polling ───────────────────────────── */
  const fetchRedisConfig = async () => {
    try { const r = await fetch('/api/redis/config'); setRedisConfig(await r.json()); } catch {}
  };
  useEffect(() => { fetchRedisConfig(); const i = setInterval(fetchRedisConfig, 3000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const poll = async () => { try { const r = await fetch('/api/redis/metrics'); setRedisMetrics(await r.json()); } catch {} };
    poll(); const i = setInterval(poll, 2000); return () => clearInterval(i);
  }, []);

  /* ── ddos polling ────────────────────────────── */
  useEffect(() => {
    const poll = async () => { try { const r = await fetch('/api/ddos/status'); setDdosStatus(await r.json()); } catch {} };
    poll(); const i = setInterval(poll, 2000); return () => clearInterval(i);
  }, []);

  /* ── api keys ────────────────────────────────── */
  const fetchApiKeys = async () => {
    try {
      const r = await fetch('/api/keys'); const data = await r.json(); setApiKeys(data);
      if (authMode === 'apikey' && !activeApiKey) { const k = data.find(k => k.enabled); if (k) setActiveApiKey(k.key); }
    } catch {}
  };
  const generateKey = async () => {
    try {
      const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newKeyName || 'My Key', tier: newKeyTier }) });
      const d = await r.json(); if (d.key) { setActiveApiKey(d.key); setNewKeyName(''); } fetchApiKeys();
    } catch {}
  };
  const revokeKey = async (key) => { await fetch(`/api/keys/${key}`, { method: 'DELETE' }); if (activeApiKey === key) setActiveApiKey(null); fetchApiKeys(); };
  const changeTier = async (key, tier) => { await fetch(`/api/keys/${key}/tier`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }); fetchApiKeys(); };
  const copyKey = (key) => { navigator.clipboard.writeText(key); setShowKeyCopied(key); setTimeout(() => setShowKeyCopied(null), 2000); };
  useEffect(() => { fetchApiKeys(); }, []);

  /* ── auth ────────────────────────────────────── */
  const handleLogin = async () => {
    setAuthError(null);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const d = await r.json(); if (d.error) { setAuthError(d.error); return; }
      setJwtToken(d.token); setJwtUser(d.user); setLoginUsername(''); setLoginPassword('');
    } catch { setAuthError('Connection failed'); }
  };
  const handleDemoLogin = async () => {
    setAuthError(null);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', password: 'password' }) });
      const d = await r.json(); if (d.error) { setAuthError(d.error); return; }
      setJwtToken(d.token); setJwtUser(d.user); setLoginUsername(''); setLoginPassword('');
    } catch { setAuthError('Connection failed'); }
  };
  const handleRegister = async () => {
    setAuthError(null);
    try {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const d = await r.json(); if (d.error) { setAuthError(d.error); return; }
      setJwtToken(d.token); setJwtUser(d.user); setLoginUsername(''); setLoginPassword(''); setRegisterMode(false);
    } catch { setAuthError('Connection failed'); }
  };
  const handleLogout = () => { setJwtToken(null); setJwtUser(null); };
  const changeAuthMode = (mode) => {
    if (mode === 'user')   { setActiveApiKey(null); }
    if (mode === 'apikey') { setJwtToken(null); setJwtUser(null); if (!activeApiKey) { const k = apiKeys.find(k => k.enabled); if (k) setActiveApiKey(k.key); } }
    setAuthMode(mode);
  };

  /* ── flush ───────────────────────────────────── */
  const handleFlush = async () => {
    setIsSpamming(false); setLoading(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      setStats({ total: 0, success: 0, blocked: 0 }); setLogs([]); setResponse(null); setError(null); setServerState(null);
      setSimulatedTokens(capacity); setSimulatedWater(0); setSlidingNodes([]); setChartData([]); chartAccumRef.current = {};
    } catch (e) { alert('Reset failed: ' + e.message); }
    finally { setLoading(false); }
  };

  /* ── static data ─────────────────────────────── */
  const algorithmsList = [
    { id: 'token_bucket',   name: 'Token Bucket',   icon: '◉', tag: 'Burst-friendly',  desc: 'Tokens refill over time. Allows bursts up to capacity.' },
    { id: 'leaky_bucket',   name: 'Leaky Bucket',   icon: '◎', tag: 'Smooth flow',      desc: 'Requests fill a bucket. Water leaks at a steady rate.' },
    { id: 'fixed_window',   name: 'Fixed Window',   icon: '▣', tag: 'Hard reset',       desc: 'Counter resets every time window. Simple but bursty.' },
    { id: 'sliding_window', name: 'Sliding Window', icon: '▤', tag: 'Most accurate',    desc: 'Rolling timestamp log. Precise, no boundary spikes.' },
  ];

  const ddosColors = { normal: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30', fill: 'bg-emerald-500' }, elevated: { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30', fill: 'bg-yellow-500' }, high: { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30', fill: 'bg-orange-500' }, critical: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30', fill: 'bg-red-500' } };
  const tierBadge   = { free: 'cyan', pro: 'green', enterprise: 'violet' };

  const inputCls = "w-full bg-zinc-900/40 border border-zinc-800/60 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:bg-zinc-900 transition-all";

  /* ── left-panel tab items ─────────────────────── */
  const tabs = [
    { id: 'algo',   icon: '⬡', label: 'Algorithm' },
    { id: 'auth',   icon: '⊛', label: 'Auth' },
    { id: 'config', icon: '⊟', label: 'Config' },
    { id: 'redis',  icon: '⟳', label: 'Redis' },
  ];

  /* ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col grid-bg">

      {/* ══ TOPBAR ══════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/60 bg-zinc-950/70 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded border border-zinc-800 bg-zinc-900/60 flex items-center justify-center text-zinc-200 text-xs font-semibold select-none">R</div>
            <span className="font-medium text-zinc-100 tracking-tight text-sm">Rate Limiter</span>
          </div>

          {/* center pills */}
          <div className="hidden md:flex items-center gap-0.5 bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-0.5">
            {algorithmsList.map(a => (
              <button key={a.id} onClick={() => setAlgorithm(a.id)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${algorithm === a.id ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-350'}`}>
                {a.name}
              </button>
            ))}
          </div>

          {/* right */}
          <div className="flex items-center gap-2.5 text-[10px]">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isRedis ? 'border-violet-900/30 bg-violet-950/20 text-violet-400' : 'border-zinc-800/60 bg-zinc-900/20 text-zinc-400'}`}>
              <Dot on={isRedis} /> {isRedis ? 'Redis' : 'Memory'}
            </div>
            {jwtUser && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-900/30 bg-emerald-950/10 text-emerald-400">
                <Dot on pulse /> {jwtUser.username}
              </div>
            )}
            <button onClick={handleFlush} className="px-2.5 py-1 rounded border border-zinc-800 hover:bg-zinc-900/40 text-zinc-450 hover:text-zinc-200 transition-all text-[10px] font-medium cursor-pointer">
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* ══ LEFT COLUMN ════════════════════════════ */}
          <aside className="xl:col-span-4 space-y-4">

            {/* Tab bar */}
            <div className="grid grid-cols-4 bg-zinc-900/20 border border-zinc-800/40 rounded-lg p-0.5 gap-0.5">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setLeftTab(t.id)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md text-center transition-all cursor-pointer ${leftTab === t.id ? 'bg-zinc-850 text-zinc-200' : 'text-zinc-500 hover:text-zinc-455'}`}>
                  <span className="text-xs leading-none">{t.icon}</span>
                  <span className="text-[8px] font-medium tracking-wider uppercase">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── ALGORITHM tab ─────────────────────── */}
            {leftTab === 'algo' && (
              <div className="glass rounded-lg p-3.5 animate-fade-in">
                <SectionTitle accent>Select Algorithm</SectionTitle>
                <div className="space-y-1.5">
                  {algorithmsList.map(a => (
                    <button key={a.id} onClick={() => setAlgorithm(a.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${algorithm === a.id ? 'algo-active border-zinc-700/60 bg-zinc-900/30' : 'border-zinc-900/30 hover:border-zinc-800/60 bg-zinc-900/10'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-medium text-xs ${algorithm === a.id ? 'text-zinc-100' : 'text-zinc-400'}`}>
                          <span className="mr-1.5 opacity-60">{a.icon}</span>{a.name}
                        </span>
                        <Badge color={algorithm === a.id ? 'indigo' : 'indigo'}>{a.tag}</Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-normal">{a.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── AUTH tab ──────────────────────────── */}
            {leftTab === 'auth' && (
              <div className="glass rounded-lg p-3.5 animate-fade-in">
                <SectionTitle accent>Authentication Mode</SectionTitle>

                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[
                    { id: 'sandbox', label: 'Headers',    sub: 'Dynamic' },
                    { id: 'ip',      label: 'By IP',       sub: 'Auto' },
                    { id: 'user',    label: 'JWT User',    sub: 'Bearer' },
                  ].map(m => (
                    <button key={m.id} onClick={() => changeAuthMode(m.id)}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${authMode === m.id ? 'bg-zinc-850 border-zinc-700 text-zinc-100' : 'border-zinc-900 bg-zinc-900/10 text-zinc-500 hover:border-zinc-850'}`}>
                      <p className="text-[10px] font-medium">{m.label}</p>
                      <p className="text-[8px] text-zinc-500 mt-0.5">{m.sub}</p>
                    </button>
                  ))}
                </div>

                {authMode === 'user' && !jwtUser && (
                  <div className="space-y-2 border-t border-zinc-900/60 pt-3">
                    <input className={inputCls} placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                    <input className={inputCls} type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    {authError && <p className="text-rose-455 text-[10px]">{authError}</p>}
                    <div className="flex gap-1.5">
                      <button onClick={handleLogin} className="flex-1 py-1.5 btn-primary text-xs cursor-pointer">Login</button>
                      <button onClick={handleDemoLogin} className="px-2.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 text-xs font-medium transition-all cursor-pointer">Demo</button>
                      <button onClick={() => { setRegisterMode(!registerMode); setAuthError(null); }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${registerMode ? 'border-emerald-900/40 text-emerald-450' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'}`}>
                        {registerMode ? 'Cancel' : 'Register'}
                      </button>
                    </div>
                    {registerMode && <button onClick={handleRegister} className="w-full py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/40 hover:bg-emerald-900/20 text-emerald-400 text-xs font-semibold transition-all cursor-pointer">Create Account</button>}
                  </div>
                )}

                {authMode === 'user' && jwtUser && (
                  <div className="border border-emerald-950/20 rounded-lg p-2.5 bg-emerald-950/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-emerald-400 font-bold">● Authenticated</span>
                      <button onClick={handleLogout} className="text-[9px] text-zinc-550 hover:text-rose-450 transition-colors cursor-pointer">Logout</button>
                    </div>
                    <p className="text-xs font-semibold text-zinc-200">{jwtUser.username}</p>
                    <code className="text-[9px] text-zinc-500 block truncate mt-1">Bearer {jwtToken?.slice(0, 28)}...</code>
                  </div>
                )}

                {authMode === 'ip' && (
                  <div className="border-t border-zinc-900/60 pt-2.5">
                    <p className="text-[10px] text-zinc-500 leading-normal">Rate limiting is keyed to your IP address. No auth headers required.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── CONFIG tab ────────────────────────── */}
            {leftTab === 'config' && (
              <div className="glass rounded-lg p-3.5 animate-fade-in space-y-4">
                <SectionTitle accent>Rate Configuration</SectionTitle>

                {/* presets */}
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Quick Presets</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {presets.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className={`py-1 px-1.5 rounded border text-[10px] font-medium text-center transition-all cursor-pointer ${activePreset === p.id ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'border-zinc-900 bg-zinc-900/10 text-zinc-550 hover:border-zinc-800'}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* sliders */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-zinc-550">Request Limit</span>
                      <span className="font-medium text-zinc-200 mono">{limit}</span>
                    </div>
                    <input type="range" min="1" max="30" value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setActivePreset('custom'); }} className="w-full cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-zinc-555">Time Window</span>
                      <span className="font-medium text-zinc-200 mono">{windowSec}s</span>
                    </div>
                    <input type="range" min="5" max="90" value={windowSec} onChange={e => { setWindowSec(parseInt(e.target.value)); setActivePreset('custom'); }} className="w-full cursor-pointer" />
                  </div>
                </div>

                {(algorithm === 'token_bucket' || algorithm === 'leaky_bucket') && (
                  <div className="border-t border-zinc-900/60 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-zinc-550">Rate Control</span>
                      <button onClick={() => { setIsAutoRates(!isAutoRates); setActivePreset('custom'); }}
                        className={`text-[9px] px-2 py-0.5 rounded border font-medium transition-all cursor-pointer ${isAutoRates ? 'bg-zinc-800 border-zinc-700 text-zinc-350' : 'border-zinc-900 text-zinc-500'}`}>
                        {isAutoRates ? 'Auto' : 'Manual'}
                      </button>
                    </div>
                    {!isAutoRates && (
                      <div>
                        <div className="flex justify-between text-[11px] mb-1.5">
                          <span className="text-zinc-550">{algorithm === 'token_bucket' ? 'Refill' : 'Leak'} Rate / sec</span>
                          <span className="mono text-zinc-300">{(algorithm === 'token_bucket' ? customRefillRate : customLeakRate).toFixed(1)}</span>
                        </div>
                        <input type="range" min="0.1" max="5" step="0.1"
                          value={algorithm === 'token_bucket' ? customRefillRate : customLeakRate}
                          onChange={e => { const v = parseFloat(e.target.value); algorithm === 'token_bucket' ? setCustomRefillRate(v) : setCustomLeakRate(v); setActivePreset('custom'); }}
                          className="w-full cursor-pointer" />
                      </div>
                    )}
                  </div>
                )}

                {/* Reset State button */}
                <div className="border-t border-zinc-900/60 pt-3">
                  <p className="text-[9px] text-zinc-500 mb-2 leading-relaxed">After changing config, reset the server state so the new limits take effect from scratch.</p>
                  <button onClick={handleFlush}
                    className="w-full py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-950/20 text-[10px] font-medium transition-all cursor-pointer">
                    ↺ Reset Rate Limit State
                  </button>
                </div>
              </div>
            )}

            {/* ── REDIS tab ─────────────────────────── */}
            {leftTab === 'redis' && (
              <div className="glass rounded-lg p-3.5 animate-fade-in">
                <div className="flex items-center justify-between mb-3.5">
                  <SectionTitle accent>Redis</SectionTitle>
                  <div className={`flex items-center gap-1.5 text-[9px] font-medium px-2 py-0.5 rounded border ${redisConfig?.connected ? 'text-emerald-450 border-emerald-900/30 bg-emerald-950/20' : 'text-rose-455 border-rose-900/30 bg-rose-955/20'}`}>
                    <Dot on={redisConfig?.connected} /> {redisConfig?.connected ? 'Connected' : 'Offline'}
                  </div>
                </div>

                <div className="space-y-2.5 mb-3.5">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[8px] text-zinc-550 uppercase tracking-wider mb-1 font-medium">Host</label>
                      <input className={inputCls} placeholder="127.0.0.1" value={redisHost} onChange={e => setRedisHost(e.target.value)} />
                    </div>
                    <div className="w-20">
                      <label className="block text-[8px] text-zinc-550 uppercase tracking-wider mb-1 font-medium">Port</label>
                      <input className={inputCls} type="number" placeholder="6379" value={redisPort} onChange={e => setRedisPort(parseInt(e.target.value) || 6379)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-550 uppercase tracking-wider mb-1 font-medium">Password (optional)</label>
                    <input className={inputCls} type="password" placeholder="••••••••" value={redisPassword} onChange={e => setRedisPassword(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      setRedisConnecting(true);
                      try {
                        const r = await fetch('/api/redis/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: redisHost, port: redisPort, password: redisPassword || null }) });
                        const d = await r.json();
                        if (!d.success) alert('Redis connection failed: ' + (d.error || 'unknown'));
                        await fetchRedisConfig();
                      } catch (e) { alert('Error: ' + e.message); }
                      setRedisConnecting(false);
                    }} disabled={redisConnecting}
                      className="flex-1 py-1.5 btn-primary text-xs disabled:opacity-50 cursor-pointer">
                      {redisConnecting ? 'Connecting…' : 'Connect'}
                    </button>
                    <button onClick={async () => { await fetch('/api/redis/disconnect', { method: 'POST' }); await fetchRedisConfig(); }}
                      className="px-2.5 py-1.5 border border-zinc-800 text-zinc-400 rounded-lg text-xs hover:border-zinc-700 hover:text-zinc-300 transition-all cursor-pointer">
                      Disconnect
                    </button>
                  </div>
                </div>

                {redisMetrics && (
                  <div className="border-t border-zinc-900/60 pt-3">
                    {redisConfig?.connected && redisMetrics.connected ? (
                      <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                        {[
                          { l: 'Mode',     v: redisMetrics.redis_mode },
                          { l: 'Version',  v: redisMetrics.version || '—' },
                          { l: 'Uptime',   v: `${redisMetrics.uptime_seconds}s` },
                          { l: 'Clients',  v: redisMetrics.connected_clients },
                          { l: 'Memory',   v: redisMetrics.used_memory_human || '—' },
                          { l: 'Keys',     v: redisMetrics.keys_count },
                          { l: 'Hit Rate', v: `${redisMetrics.hit_rate}%`, color: redisMetrics.hit_rate > 80 ? 'text-emerald-400' : 'text-amber-450' },
                          { l: 'Commands', v: redisMetrics.total_commands_processed || redisMetrics.commands_processed },
                        ].map(({ l, v, color }) => (
                          <div key={l} className="bg-zinc-900/20 border border-zinc-800/40 rounded p-1.5">
                            <p className="text-zinc-550 mb-0.5 text-[8px] uppercase tracking-wider">{l}</p>
                            <p className={`font-semibold mono text-[10px] ${color || 'text-zinc-200'}`}>{v}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-zinc-650">
                        <p className="text-[10px] mb-0.5">Not connected to Redis.</p>
                        <p className="text-[9px]">Falling back to in-memory storage.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DDoS Status widget (Always visible at the bottom of left column) */}
            {ddosStatus && (() => {
              const s = ddosStatus.severity || 'normal';
              const c = ddosColors[s];
              const pct = Math.min(100, Math.round((ddosStatus.ratio || 0) * 100));
              return (
                <div className="glass rounded-lg p-3.5 space-y-3 transition-all duration-300">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-550 font-medium">DDoS Status</span>
                      <div className={`flex items-center gap-1 px-1.5 py-0.2 rounded border ${c.border.replace('border-emerald-500/30', 'border-emerald-900/30').replace('border-yellow-500/30', 'border-yellow-900/30').replace('border-orange-500/30', 'border-orange-900/30').replace('border-red-500/30', 'border-red-900/30')} bg-zinc-900/25 ${c.text} text-[8px] font-semibold uppercase`}>
                        <span className={`w-1 h-1 rounded-full ${c.bg} ${s !== 'normal' ? 'animate-pulse' : ''}`} />
                        {s}
                      </div>
                    </div>
                    <button onClick={() => setShowSpammer(!showSpammer)}
                      className={`text-[9px] px-2 py-0.5 rounded border transition-all cursor-pointer ${showSpammer ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-350'}`}>
                      {isSpamming ? 'Spamming' : 'Spammer'}
                    </button>
                  </div>

                  {/* Threat Load Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-zinc-500">
                      <span>Traffic Load</span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-rose-500' : pct >= 60 ? 'bg-orange-500' : pct >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Collapsible Spammer Controls */}
                  {showSpammer && (
                    <div className="border-t border-zinc-900/60 pt-2.5 space-y-2.5 animate-fade-in">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-zinc-550">Spamming Rate</span>
                        <span className="font-medium text-zinc-300 mono">{spamRps} Req/sec</span>
                      </div>
                      <input type="range" min="1" max="10" value={spamRps} disabled={isSpamming} onChange={e => setSpamRps(parseInt(e.target.value))} className="w-full cursor-pointer" />
                      <button onClick={() => setIsSpamming(!isSpamming)}
                        className={`w-full py-1 rounded text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${isSpamming ? 'bg-rose-950/20 border border-rose-900/40 text-rose-450 hover:bg-rose-900/10' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'}`}>
                        {isSpamming ? 'Stop Spamming' : 'Spam Requests'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          </aside>

          {/* ══ RIGHT COLUMN ═══════════════════════════ */}
          <section className="xl:col-span-8 space-y-4">

            {/* ── Fire request buttons ─────────────── */}
            <div className="glass rounded-lg p-3">
              <div className="flex flex-col gap-2">
                <button onClick={() => triggerRequest('/api/data')} disabled={loading}
                  className="w-full py-2 btn-primary rounded-lg text-xs disabled:opacity-40 cursor-pointer">
                  {loading ? <span className="animate-pulse">Fetching…</span> : <>GET Data <span className="ml-1.5 text-[9px] opacity-75 border border-zinc-950/20 rounded px-1.5 py-0.2 font-mono">/api/data</span></>}
                </button>
              </div>
            </div>

            {/* ── Stats row ─────────────────────────── */}
            <div className="grid grid-cols-4 gap-2.5">
              <MetricBox label="Total"   value={stats.total}   />
              <MetricBox label="Allowed" value={stats.success} color="text-emerald-400" />
              <MetricBox label="Blocked" value={stats.blocked} color="text-rose-400" />
              <MetricBox label="Pass Rate"
                value={stats.total > 0 ? `${Math.round((stats.success / stats.total) * 100)}%` : '—'}
                color="text-indigo-400" />
            </div>

            {/* ── Chart + Algorithm visual ───────────── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

              {/* Chart */}
              <div className="glass rounded-lg p-3.5 md:col-span-3">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Traffic Flow</h3>
                  <div className="flex items-center gap-2.5 text-[9px]">
                    <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Allowed</span>
                    <span className="flex items-center gap-1 text-rose-400"><span className="w-1.5 h-1.5 rounded-full bg-rose-450 inline-block" />Blocked</span>
                  </div>
                </div>
                <div className="h-40">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.04} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gBlocked" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.04} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" />
                        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#52525b' }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 8, fill: '#52525b' }} />
                        <Tooltip contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '10px' }} labelStyle={{ color: '#a1a1aa' }} />
                        <Area type="monotone" dataKey="success" stroke="#10b981" fill="url(#gSuccess)" strokeWidth={1.5} dot={false} />
                        <Area type="monotone" dataKey="blocked" stroke="#f43f5e" fill="url(#gBlocked)" strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-650">
                      <p className="text-xs">No data yet</p>
                      <p className="text-[10px] mt-0.5">Send requests to populate the chart</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Algorithm state visual */}
              <div className="glass rounded-lg p-3.5 md:col-span-2 flex flex-col">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-2.5">
                  {algorithmsList.find(a => a.id === algorithm)?.name} State
                </h3>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full">
                  {algorithm === 'token_bucket' && (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-light mono text-zinc-200">{simulatedTokens.toFixed(1)}</p>
                        <p className="text-[10px] text-zinc-550 mt-0.5">of {capacity} tokens</p>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400/90 rounded-full transition-all duration-300" style={{ width: `${(simulatedTokens / capacity) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-500">Refill: {(activeRefillRateMs * 1000).toFixed(2)} tokens/ms</p>
                    </>
                  )}

                  {algorithm === 'leaky_bucket' && (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-light mono text-zinc-200">{simulatedWater.toFixed(1)}</p>
                        <p className="text-[10px] text-zinc-550 mt-0.5">of {capacity} capacity</p>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400/90 rounded-full transition-all duration-300" style={{ width: `${(simulatedWater / capacity) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-500">Leak: {(activeLeakRateMs * 1000).toFixed(2)}/ms</p>
                    </>
                  )}

                  {algorithm === 'fixed_window' && (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-light mono text-zinc-200">{serverState ? serverState.count : 0}</p>
                        <p className="text-[10px] text-zinc-550 mt-0.5">of {limit} requests used</p>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400/90 rounded-full transition-all duration-500" style={{ width: `${((serverState?.count || 0) / limit) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-500">Resets in <span className="text-amber-400 font-medium mono">{windowResetTime}s</span></p>
                    </>
                  )}

                  {algorithm === 'sliding_window' && (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-light mono text-zinc-200">{slidingNodes.length}</p>
                        <p className="text-[10px] text-zinc-550 mt-0.5">of {limit} in window</p>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 border border-zinc-850/40 rounded relative overflow-hidden">
                        {slidingNodes.map(node => {
                          const pos = 100 - ((Date.now() - node.timestamp) / (windowSec * 1000)) * 100;
                          if (pos < 0 || pos > 100) return null;
                          return <div key={node.id} className="absolute top-0 bottom-0 w-[1.5px] bg-violet-400" style={{ left: `${pos}%` }} />;
                        })}
                      </div>
                      <p className="text-[9px] text-zinc-500">Rolling {windowSec}s window</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Response panel ────────────────────── */}
            <div className={`glass rounded-lg p-3.5 border-l-2 transition-all ${error ? 'border-l-rose-500 bg-rose-955/5' : response ? 'border-l-emerald-500 bg-emerald-955/5' : 'border-l-zinc-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Response</h3>
                {error    && <Badge color="red">429 Blocked</Badge>}
                {response && <Badge color="green">200 Allowed</Badge>}
                {!error && !response && <span className="text-[9px] text-zinc-500">Waiting for request…</span>}
              </div>
              {(error || response) && (
                <pre className="text-[10px] mono text-zinc-400 whitespace-pre-wrap bg-zinc-950/60 rounded border border-zinc-900/60 p-2.5 max-h-36 overflow-y-auto">
                  {JSON.stringify(error || response, null, 2)}
                </pre>
              )}
            </div>

            {/* ── Request log ───────────────────────── */}
            <div className="glass rounded-lg p-3.5">
              <div className="flex justify-between items-center mb-2.5">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Request Log</h3>
                <button onClick={() => setLogs([])} className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/10 cursor-pointer">
                  Clear
                </button>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-900/60 rounded-lg p-2.5 h-48 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-zinc-600 text-[10px] italic mono text-center pt-8">// no requests yet</p>
                ) : logs.map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-[10px] mono border-b border-zinc-900/30 pb-1.5 pt-0.5 last:border-0 animate-fade-in">
                    <span className="text-zinc-650 shrink-0">[{log.time}]</span>
                    <span className={`font-semibold shrink-0 w-8 text-center rounded text-[10px] ${log.status === 200 ? 'text-emerald-450' : log.status === 429 ? 'text-rose-455' : 'text-amber-455'}`}>{log.status}</span>
                    <span className="text-zinc-400 truncate flex-1">{log.path}</span>
                    {log.remaining !== null && <span className="text-zinc-650 shrink-0 text-[9px]">rem:{log.remaining}</span>}
                    <span className={`text-[8px] px-1 py-0.2 rounded border shrink-0 ${log.mode === 'Redis' ? 'border-violet-900/30 text-violet-400 bg-violet-955/10' : 'border-zinc-800 text-zinc-600 bg-zinc-900/20'}`}>{log.mode}</span>
                  </div>
                ))}
              </div>
            </div>

          </section>
        </div>
      </main>

      {/* ══ FOOTER ═══════════════════════════════════ */}
      <footer className="border-t border-zinc-900/40 py-3 text-center">
        <p className="text-[9px] text-zinc-600 mono">Rate Limiter — Interactive API Rate Limiting Dashboard</p>
      </footer>
    </div>
  );
}
