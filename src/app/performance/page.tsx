export default function PerformancePage() {
  return (
    <main style={{padding:"40px",color:"white",background:"#0b0f19",minHeight:"100vh"}}>
      <h1>YieldCraft Performance</h1>

      <p>Core Fund Statistics</p>

      <div style={{marginTop:"20px"}}>
        <p><strong>Peak Equity:</strong> $51.71</p>
        <p><strong>Current Equity:</strong> $46.97</p>
        <p><strong>Trades (30d):</strong> 19</p>
        <p><strong>Volume (30d):</strong> $181.19</p>
      </div>

      <p style={{marginTop:"40px"}}>
        Performance metrics update automatically as the trading engine runs.
      </p>
    </main>
  )
}