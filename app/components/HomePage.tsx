"use client";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Code2, Zap, Wallet, TestTube2, Network, Lock, ArrowRight } from "lucide-react";

interface HomePageProps {
  onEnterLab: () => void;
}

export function HomePage({ onEnterLab }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold">BitLab</h1>
          </div>
          <Button onClick={onEnterLab} size="sm">
            Launch
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold">Build & Test</h2>
          <p className="text-muted max-w-2xl mx-auto">
            Compact, professional development environment for blockchain applications
          </p>
          <Button onClick={onEnterLab} size="lg">
            Start Building
            <Code2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: Code2, label: "Transaction Builder", desc: "Craft transactions visually" },
            { icon: Lock, label: "Secure Signing", desc: "Sign locally in browser" },
            { icon: Wallet, label: "Wallet Manager", desc: "Manage test wallets" },
            { icon: TestTube2, label: "Testnet Faucet", desc: "Get test tokens instantly" },
            { icon: Zap, label: "Lightning Network", desc: "Test L2 payments" },
            { icon: Network, label: "Multi-Network", desc: "Testnet, Signet, Regtest" },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Card key={i} className="p-3">
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-xs">{feature.label}</h3>
                    <p className="text-xs text-muted">{feature.desc}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
