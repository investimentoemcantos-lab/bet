import { useState } from "react";
import { ArrowUpRight, ShieldCheck, BarChart3 } from "lucide-react";
import { supabase } from "./lib";
export default function Auth() {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <main className="auth">
      <section className="auth-brand">
        <div className="logo">
          b<span>et</span>
          <i />
        </div>
        <div>
          <p className="eyebrow">CONTROLE. CONSISTÊNCIA. CLAREZA.</p>
          <h1>
            Sua banca.
            <br />
            Sua visão de jogo.
          </h1>
          <p>
            Registre cada entrada. Entenda seus resultados.
            <br />
            Tenha seus números sempre à mão.
          </p>
          <div className="auth-symbol">
            <BarChart3 size={100} />
            <ArrowUpRight size={80} />
          </div>
        </div>
        <small>
          <ShieldCheck size={16} /> Seus registros protegidos e separados por
          conta.
        </small>
      </section>
      <section className="auth-form">
        <div className="auth-box">
          <p className="eyebrow">BEM-VINDO AO BET</p>
          <h2>
            {mode === "login"
              ? "Entre no seu painel"
              : mode === "reset"
                ? "Recupere seu acesso"
                : "Crie sua conta"}
          </h2>
          <p className="muted">Seu próximo passo começa com organização.</p>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              setMsg("");
              const f = new FormData(ev.currentTarget);
              const email = String(f.get("email"));
              const password = String(f.get("password"));
              try {
                const r =
                  mode === "login"
                    ? await supabase.auth.signInWithPassword({
                        email,
                        password,
                      })
                    : mode === "reset"
                      ? await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: location.origin,
                        })
                      : await supabase.auth.signUp({
                          email,
                          password,
                          options: { emailRedirectTo: location.origin },
                        });
                if (r.error) throw r.error;
                if (mode !== "login")
                  setMsg(
                    mode === "reset"
                      ? "Confira seu e-mail para recuperar o acesso."
                      : "Conta criada. Confira seu e-mail para confirmar o cadastro.",
                  );
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input
                name="email"
                type="email"
                placeholder="voce@email.com"
                required
                autoComplete="email"
              />
            </label>
            {mode !== "reset" && (
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Mínimo de 8 caracteres"
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar"
                  : mode === "reset"
                    ? "Enviar link"
                    : "Criar conta"}
            </button>
          </form>
          {msg && (
            <p role="status" className="notice">
              {msg}
            </p>
          )}
          <button
            className="text-button"
            onClick={() => {
              setMsg("");
              setMode(mode === "signup" ? "login" : "signup");
            }}
          >
            {mode === "signup" ? "Já tenho uma conta" : "Criar uma conta"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setMsg("");
              setMode(mode === "reset" ? "login" : "reset");
            }}
          >
            {mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}
          </button>
        </div>
      </section>
    </main>
  );
}
