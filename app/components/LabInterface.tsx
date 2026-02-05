"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Wallet,
  Code2,
  Eye,
  Settings,
  Home,
  TestTube2,
  Zap,
  ChevronDown,
  Network,
  Save,
  Share,
  Plus,
  Trash2,
  Copy,
} from "lucide-react";

interface LabInterfaceProps {
  onBackToHome: () => void;
}

export function LabInterface({ onBackToHome }: LabInterfaceProps) {
  const [activeTab, setActiveTab] = useState("build");

  const mainNavItems = [
    { id: "build", label: "Transactions", icon: Code2 },
    { id: "view", label: "View Raw", icon: Eye },
    { id: "account", label: "Address", icon: Wallet },
    { id: "api", label: "RPC Explorer", icon: Network },
    { id: "script", label: "Script", icon: Settings },
    { id: "saved", label: "Saved", icon: Save },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Main Nav */}
            <div className="flex items-center gap-6">
              <Button
                onClick={onBackToHome}
                variant="ghost"
                size="sm"
                className="gap-2 text-primary font-semibold"
              >
                <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-white" />
                </div>
                BitLab
              </Button>
              
              {/* Main Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-primary text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right: Network Selector */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Testnet</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Transaction Builder */}
        {activeTab === "build" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Build Transaction</h1>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" size="sm">
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Transaction Params */}
              <div className="lg:col-span-2 space-y-6">
                {/* Params Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">From Address</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter Bitcoin address (1... or 3... or bc1...)"
                          className="flex-1 compact-input"
                        />
                        <Button size="sm">Load UTXO</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Fee Rate (sat/vB)</label>
                        <input type="text" defaultValue="10" className="compact-input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Lock Time</label>
                        <input type="text" defaultValue="0" className="compact-input" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Message (optional)</label>
                      <input type="text" placeholder="OP_RETURN data" className="compact-input" />
                    </div>
                  </CardContent>
                </Card>

                {/* Operations Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Inputs & Outputs</CardTitle>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Input
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Input 1</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Previous Transaction ID</label>
                          <input type="text" placeholder="Enter txid" className="compact-input font-mono text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-2">Output Index</label>
                            <input type="text" placeholder="0" className="compact-input" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Amount (BTC)</label>
                            <input type="text" placeholder="0.00000000" className="compact-input" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Script Sig</label>
                          <textarea placeholder="Unlocking script" className="compact-input h-16 font-mono text-xs" />
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Output 1</span>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Output
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Recipient Address</label>
                          <input type="text" placeholder="Enter Bitcoin address" className="compact-input" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Amount (BTC)</label>
                          <input type="text" placeholder="0.00000000" className="compact-input" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Script PubKey</label>
                          <textarea placeholder="Locking script" className="compact-input h-16 font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Transaction Validation */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction Validation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Build your transaction to see validation results</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full" size="sm">
                      Sign Transaction
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      View Raw Transaction
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      Broadcast to Network
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs content */}
        {activeTab === "view" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">View Raw Transaction</h1>
            <Card>
              <CardContent className="pt-6">
                <textarea
                  placeholder="Paste raw transaction hex here..."
                  className="w-full h-64 compact-input font-mono text-xs"
                />
                <Button className="mt-3">Decode Transaction</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "account" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Address Viewer</h1>
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Enter Bitcoin address (1... or 3... or bc1...)"
                    className="flex-1 compact-input"
                  />
                  <Button>Load Address</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Bitcoin RPC Explorer</h1>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">Explore Bitcoin Core RPC methods</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">getblockchaininfo</Button>
                  <Button variant="outline" className="w-full justify-start">getblock</Button>
                  <Button variant="outline" className="w-full justify-start">getrawtransaction</Button>
                  <Button variant="outline" className="w-full justify-start">sendrawtransaction</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "script" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Script Debugger</h1>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Script</label>
                    <textarea
                      placeholder="Enter Bitcoin script (OP_DUP OP_HASH160 ...)"
                      className="w-full h-32 compact-input font-mono text-xs"
                    />
                  </div>
                  <Button>Execute Script</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "saved" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Saved Items</h1>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600">No saved transactions yet</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
