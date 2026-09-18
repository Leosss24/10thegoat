import Link from "next/link";
import { articles } from "@/data/articles";
import ArticleTags from "./ArticleTags";

export default function FeaturedArticles(){
  return <section className="home-featured-articles" aria-labelledby="featured-articles-title">
    <header><div><span className="eyebrow">Para seguir leyendo</span><h2 id="featured-articles-title">Artículos destacados</h2></div><Link href="/es/articulos">Ver todos →</Link></header>
    <div className="featured-articles-grid">
      {articles.slice(0,3).map((article)=><article className="article-card" key={article.slug}>
        <Link className="article-card-image" href={`/es/articulos/${article.slug}`}><img src={article.image.src} alt={article.image.alt}/></Link>
        <div className="article-card-content"><ArticleTags tags={article.tags}/><h2><Link href={`/es/articulos/${article.slug}`}>{article.title}</Link></h2><p>{article.excerpt}</p><footer><span>{article.readingTime} min</span></footer></div>
        <a className="article-image-credit" href={article.image.creditUrl} target="_blank" rel="noopener noreferrer">Imagen: {article.image.credit}</a>
      </article>)}
    </div>
  </section>;
}
