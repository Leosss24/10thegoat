import raw from './catalog.json';
export type Locale = 'es' | 'en' | 'fr';
export type Badge = { id:string; game:string; metric:string; target:number; challengeId?:string; name:Record<Locale,string>; description:Record<Locale,string> };
export const badges: Badge[] = raw;
export const palettes: Record<string,[string,string]> = {'adivina-jugador':['#8DFF57','#17300b'],carrera:['#E8C568','#382b0b'],'mayor-o-menor':['#FF675F','#3d1414'],'football-grid':['#32A7FF','#092a43'],'adivina-escudo':['#B76CFF','#29123e'],trivia:['#FFAB5C','#42240c'],'el-intruso':['#F5F8FC','#14202d'],conexiones:['#2DD4BF','#0B302B'],'ordena-historia':['#F472B6','#3B1630']};
export const gameNames: Record<string,Record<Locale,string>> = Object.fromEntries([
 ['adivina-jugador','Adivina el jugador','Guess the player','Devinez le joueur'],['carrera','Modo Carrera','Career mode','Mode Carrière'],['mayor-o-menor','Mayor o menor','Higher or lower','Plus ou moins'],['football-grid','Football Grid','Football Grid','Football Grid'],['adivina-escudo','Adivina el escudo','Guess the badge','Devinez l’écusson'],['trivia','Trivia','Trivia','Trivia'],['el-intruso','El intruso','Odd one out','L’intrus'],['conexiones','Conexiones','Connections','Connexions'],['ordena-historia','Ordena la historia','Order history','Ordonnez l’histoire']
].map(([id,es,en,fr])=>[id,{es,en,fr}]));
