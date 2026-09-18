import Link from "next/link";
import ArticleCatalog from "./ArticleCatalog";

export default function ArticlesIndex(){return <main className="articles-index container"><Link className="text-link" href="/es">← Volver al inicio</Link><header><span className="eyebrow">Historias para entender el juego</span><h1>ARTÍCULOS</h1><p>Historia, táctica, reglas y curiosidades explicadas con fuentes y sin dar nada por sabido.</p></header><ArticleCatalog/></main>}
