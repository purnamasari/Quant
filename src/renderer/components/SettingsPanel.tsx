import { LlmSetupForm } from './LlmSetupForm';
import '../styles/settings.css';

export function SettingsPanel() {
  return (
    <div className="settings-panel">
      <header className="settings-head">
        <div>
          <span className="settings-kicker num">MODEL RUNTIME</span>
          <h2>Quant AI Settings</h2>
          <p>Choose one inference provider for the analyst, verifier, and orchestrator workers.</p>
        </div>
        <span className="settings-security">OS-encrypted credentials</span>
      </header>
      <section className="settings-card">
        <LlmSetupForm />
      </section>
    </div>
  );
}
