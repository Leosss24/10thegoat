"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }){
  return <main className="empty-state container"><img src="/brand/10thegoat-shield-128x128.png" alt=""/><span className="eyebrow">Error</span><h1>Algo se ha roto.</h1><p>Estamos en Beta. Puedes volver a intentarlo y, si persiste, reportarlo desde la página Beta.</p><button className="btn btn-primary" onClick={reset}>Reintentar</button></main>
}
