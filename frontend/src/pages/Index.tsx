import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Activity, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col relative">

      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 mb-24">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-default backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Live on Somnia Testnet
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-geist font-bold tracking-tight leading-[1.1]">
          Security for the <br />
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-gradient-x">
            High-Speed Era
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Real-time monitoring, AI-powered vulnerability detection, and instant alerts for your Somnia smart contracts.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button
            size="lg"
            className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all duration-300"
            onClick={() => navigate('/dashboard')}
          >
            Start Monitoring <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-8 text-lg rounded-full border-border bg-card/50 hover:bg-card backdrop-blur-sm transition-all duration-300"
          >
            View Documentation
          </Button>
        </div>

        {/* Terminal Preview */}
        <div className="relative w-full max-w-4xl rounded-xl border border-border bg-card/50 backdrop-blur-md shadow-2xl overflow-hidden text-left mx-auto">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
            <div className="ml-2 text-xs text-muted-foreground font-mono">chainguard-cli — monitoring</div>
          </div>
          <div className="p-6 font-mono text-sm space-y-2">
            <div className="flex gap-2">
              <span className="text-success">➜</span>
              <span className="text-blue-400">~</span>
              <span>chainguard monitor --address 0x123...abc</span>
            </div>
            <div className="text-muted-foreground">Starting real-time monitoring on Somnia Testnet...</div>
            <div className="text-success">✔ Connected to SDS (Somnia Data Stream)</div>
            <div className="text-success">✔ AI Model Loaded (v2.4.0)</div>
            <br />
            <div className="flex gap-2">
              <span className="text-muted-foreground">[10:42:15]</span>
              <span className="text-blue-400">INFO</span>
              <span>Transaction detected: 0x8f2...9a1</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">[10:42:16]</span>
              <span className="text-warning">WARN</span>
              <span>Gas usage spike detected (+450%)</span>
            </div>
            <div className="flex gap-2 animate-pulse">
              <span className="text-muted-foreground">[10:42:16]</span>
              <span className="text-primary">ANALYZING</span>
              <span>Verifying reentrancy pattern...</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-geist font-bold mb-4">Everything you need to stay safe</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built specifically for the high-throughput architecture of Somnia Network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={Activity}
            title="Real-Time Streams"
            description="Leveraging Somnia Data Streams (SDS) to capture events milliseconds after they occur."
            color="text-blue-400"
            bg="bg-blue-400/10"
          />
          <FeatureCard
            icon={Zap}
            title="AI Analysis"
            description="Our ML models are trained on thousands of exploit vectors to detect zero-day vulnerabilities."
            color="text-yellow-400"
            bg="bg-yellow-400/10"
          />
          <FeatureCard
            icon={Lock}
            title="Private by Design"
            description="Your monitoring configurations are encrypted and linked only to your wallet signature."
            color="text-green-400"
            bg="bg-green-400/10"
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color, bg }: any) {
  return (
    <div className="group p-8 rounded-2xl border border-border bg-card hover:bg-accent/5 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <h3 className="text-xl font-semibold mb-3 font-geist">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
