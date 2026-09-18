import Link from "next/link";
import { articleTags, type ArticleTag } from "@/data/articles";

export default function ArticleTags({ tags, linked = true }: { tags: ArticleTag[]; linked?: boolean }) {
  return <div className="article-tags" aria-label="Temas del artículo">{tags.map((tag) => linked ? <Link key={tag} href={`/es/articulos?tag=${tag}`}>{articleTags[tag].label}</Link> : <span key={tag}>{articleTags[tag].label}</span>)}</div>;
}
