"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { articles, articleTags, type ArticleTag } from "@/data/articles";
import ArticleTags from "./ArticleTags";

export default function ArticleCatalog(){
  const [active,setActive]=useState<ArticleTag|null>(null);
  const visible=useMemo(()=>active?articles.filter((article)=>article.tags.includes(active)):articles,[active]);
  return <><div className="tag-filters" aria-label="Filtrar artículos por tema"><button className={!active?"active":""} onClick={()=>setActive(null)}>Todos <span>{articles.length}</span></button>{(Object.keys(articleTags) as ArticleTag[]).map((tag)=>{const count=articles.filter((article)=>article.tags.includes(tag)).length;return <button key={tag} className={active===tag?"active":""} disabled={!count} onClick={()=>setActive(tag)}>{articleTags[tag].label} <span>{count}</span></button>})}</div><div className="article-grid">{visible.map((article)=><article className="article-card" key={article.slug}><Link className="article-card-image" href={`/es/articulos/${article.slug}`}><img src={article.image.src} alt={article.image.alt}/></Link><div className="article-card-content"><ArticleTags tags={article.tags}/><h2><Link href={`/es/articulos/${article.slug}`}>{article.title}</Link></h2><p>{article.excerpt}</p><footer><time dateTime={article.publishedAt}>{new Date(`${article.publishedAt}T12:00:00`).toLocaleDateString("es-ES")}</time><span>{article.readingTime} min</span></footer></div><a className="article-image-credit" href={article.image.creditUrl} target="_blank" rel="noopener noreferrer">Imagen: {article.image.credit}</a></article>)}</div></>;
}
