import Link from "next/link";
export default function NotFound(){return <main className="empty-state container"><img src="/brand/10thegoat-shield-128x128.png" alt=""/><span className="eyebrow">404</span><h1>Fuera de juego.</h1><p>Esta página no existe o todavía no ha salido al campo.</p><Link className="btn btn-primary" href="/">Volver al inicio</Link></main>}
