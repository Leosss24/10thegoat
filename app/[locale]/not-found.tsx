"use client";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
export default function NotFound() { const { locale, dictionary: d } = useI18n(); return <main className="empty-state container"><img src="/brand/10thegoat-shield-128x128.png" alt=""/><span className="eyebrow">404</span><h1>{d.notFound.title}</h1><p>{d.notFound.body}</p><Link className="btn btn-primary" href={`/${locale}`}>{d.notFound.back}</Link></main>; }
