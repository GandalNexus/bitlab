"use client";

import { useState } from "react";
import { HomePage } from "./components/HomePage";
import { LabInterface } from "./components/LabInterface";

export default function Home() {
  const [currentView, setCurrentView] = useState<"home" | "lab">("home");

  return (
    <>
      {currentView === "home" ? (
        <HomePage onEnterLab={() => setCurrentView("lab")} />
      ) : (
        <LabInterface onBackToHome={() => setCurrentView("home")} />
      )}
    </>
  );
}
