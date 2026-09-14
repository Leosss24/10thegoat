import bank from "../../data/connections/puzzles.json";
import legacy from "../../data/connections/legacy.json";
export type Locale = "es" | "en" | "fr";
export type Translation = Record<Locale, string>;
export type ConnectionMember = { id: string; label: string; playerId?: number; photo_url?: string | null };
export type ConnectionGroup = { id: string; title: Translation; reason: Translation; members: ConnectionMember[] };
export type ConnectionPuzzle = { id: string; groups: ConnectionGroup[] };
export const connectionPuzzles: ConnectionPuzzle[] = bank;
// Only used to resume a board saved before the catalog expansion.
export const legacyConnectionPuzzles: ConnectionPuzzle[] = legacy;

export const connectionsCopy={
 es:{title:"CONEXIONES",description:"Agrupa 16 nombres en cuatro conexiones futbolísticas ocultas.",intro:"Selecciona cuatro nombres que compartan una conexión. Tienes cuatro errores.",selected:"seleccionados",submit:"Comprobar grupo",clear:"Limpiar",mistakes:"Errores disponibles",solved:"Grupos resueltos",correct:"Conexión encontrada",wrong:"Esos cuatro no forman un grupo",won:"Tablero completado",lost:"Sin errores disponibles",play:"Jugar",again:"Nuevo tablero",points:"Puntos",rules:"Cómo se juega",rulesText:"Forma cuatro grupos de cuatro. Un nombre pertenece a un único grupo del tablero, aunque pueda sugerir otras conexiones. Cada fallo consume un error.",storage:"No se pudo guardar la partida; puedes seguir jugando."},
 en:{title:"CONNECTIONS",description:"Sort 16 names into four hidden football connections.",intro:"Select four names that share a connection. You have four mistakes.",selected:"selected",submit:"Check group",clear:"Clear",mistakes:"Mistakes left",solved:"Groups solved",correct:"Connection found",wrong:"Those four do not form a group",won:"Board completed",lost:"No mistakes left",play:"Play",again:"New board",points:"Points",rules:"How to play",rulesText:"Make four groups of four. Each name belongs to one board group, even if it suggests other links. Every wrong guess costs one mistake.",storage:"The game could not be saved; you can keep playing."},
 fr:{title:"CONNEXIONS",description:"Classez 16 noms selon quatre liens footballistiques cachés.",intro:"Sélectionnez quatre noms partageant un lien. Vous avez droit à quatre erreurs.",selected:"sélectionnés",submit:"Vérifier le groupe",clear:"Effacer",mistakes:"Erreurs restantes",solved:"Groupes trouvés",correct:"Connexion trouvée",wrong:"Ces quatre noms ne forment pas un groupe",won:"Grille terminée",lost:"Plus aucune erreur",play:"Jouer",again:"Nouvelle grille",points:"Points",rules:"Comment jouer",rulesText:"Formez quatre groupes de quatre. Chaque nom appartient à un seul groupe de la grille, même s'il peut suggérer d'autres liens. Chaque erreur coûte une tentative.",storage:"La partie n'a pas pu être enregistrée ; vous pouvez continuer."}
} as const;
