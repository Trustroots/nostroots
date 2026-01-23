import { useState } from "react";
import { Button } from "@/components/Button";
import { Counter } from "@/components/Counter";

function App() {
  const [showCounter, setShowCounter] = useState(true);

  return (
    <div className="app">
      <header className="app-header">
        <h1>NR Web App</h1>
      </header>
      <main className="app-main">
        <Button onClick={() => setShowCounter(!showCounter)}>
          {showCounter ? "Hide Counter" : "Show Counter"}
        </Button>
        {showCounter && <Counter initialValue={0} />}
      </main>
    </div>
  );
}

export default App;
