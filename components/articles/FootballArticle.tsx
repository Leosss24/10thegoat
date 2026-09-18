import Link from "next/link";
import type { ArticleSummary } from "@/data/articles";
import { articleExtensions, type EditorialArticle } from "@/data/article-content";
import ArticleTags from "./ArticleTags";

export default function FootballArticle({ summary, content }: { summary: ArticleSummary; content: EditorialArticle }) {
  const extension = articleExtensions[summary.slug];
  return <article className="article-page container">
    <Link className="text-link" href="/es/articulos">← Volver a artículos</Link>
    <div className="article-inline-tags"><ArticleTags tags={content.tags}/></div>
    <header><span className="eyebrow">{content.kicker} · {summary.readingTime} min</span><h1>{summary.title}</h1><p className="article-lead">{content.intro}</p></header>
    <figure className="article-hero-image"><img src={summary.image.src} alt={summary.image.alt}/><figcaption>Imagen: <a href={summary.image.creditUrl} target="_blank" rel="noopener noreferrer">{summary.image.credit}</a>.</figcaption></figure>
    <div className="article-body">
      {content.sections.map((item, index) => <section key={item.title}><h2>{item.title}</h2>{item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{index === 1 && <aside><strong>¿Sabías que...?</strong><p>{content.fact}</p></aside>}</section>)}
      {extension && <section><h2>{extension.title}</h2>{extension.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>}
      <section className="article-sources"><h2>Fuentes y lecturas recomendadas</h2><ul>{content.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></section>
      <p className="article-back-link"><Link href="/es/articulos">← Ver todos los artículos</Link></p>
    </div>
  </article>;
}
