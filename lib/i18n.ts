import { legalCopy } from "./ads/legal-copy";

export const locales = ["es", "en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localizedPath(locale: Locale, path = "") {
  return `/${locale}${path === "/" ? "" : path}`;
}

export const dictionaries = {
  es: {
    languageName: "Español", nav: { home: "Inicio", games: "Juegos", beta: "Beta", main: "Navegación principal", legal: "Información legal", privacy: "Privacidad", cookies: "Cookies", notice: "Aviso legal", feedback: "Feedback", language: "Idioma" },
    meta: { title: "Juegos de fútbol online", description: "Juegos de fútbol online para poner a prueba tus conocimientos: Adivina el jugador, Mayor o Menor, Adivina el Escudo y más.", shortDescription: "Pon a prueba cuánto sabes de fútbol con retos y minijuegos gratuitos." },
    home: { alt: "10theGOAT · Juegos de fútbol online", eyebrow: "10theGOAT Arena", title: "El fútbol también se juega aquí.", intro: "Elige tu reto, demuestra cuánto sabes de fútbol y supera tu mejor marca.", play: "Empezar a jugar", beta: "Explorar juegos", version: "Arena", games: "Juegos", all: "Ver todos" },
    catalog: { title: "Todos los juegos" },
    status: { available: "Ya disponible", beta: "Disponible en fase Beta", soon: "Próximamente" },
    games: {
      higherLower: { title: "Mayor o Menor", description: "Compara estadísticas de futbolistas y encadena la mayor racha posible.", meta: "Compara goles de temporadas reales y encadena la mayor racha posible.", eyebrow: "Estadísticas reales · clubes", intro: "Compara temporadas reales. Acierta si el futbolista de la derecha marcó más o menos goles que el de la izquierda y construye tu racha." },
      wordle: { title: "Adivina el jugador", description: "Wordle futbolero: seis intentos para descubrir el nombre futbolístico del jugador letra a letra.", meta: "Wordle futbolero: descubre el nombre del jugador en seis intentos.", eyebrow: "Wordle futbolero", intro: "Seis intentos. Una letra verde está en su sitio; una amarilla está en el nombre, pero en otra posición. Las tildes no cuentan." },
      grid: { title: "Football Grid", description: "Cruza clubes, selecciones y condiciones para encontrar jugadores válidos." },
      career: { title: "Modo Carrera", description: "Crea un jugador y simula toda su carrera, fichajes, títulos, selección y legado." },
      eleven: { title: "Mi XI", description: "Construye tu once ideal con presupuesto, restricciones y cartas de jugador." },
      badge: { title: "Adivina el Escudo", description: "Reconoce el club por un escudo extremadamente pixelado que se aclara con cada intento.", meta: "Reconoce el club mientras su escudo se desvela intento a intento.", eyebrow: "Escudos de clubes", intro: "El escudo empieza casi irreconocible. Cada fallo reduce el pixelado. Tienes seis intentos para descubrir el club." },
      placeholder: { body: "La ruta ya está preparada. Este módulo se conectará al núcleo común de datos de 10theGOAT.", label: "⚽ Módulo en construcción" }
    },
    beta: { title: "JUEGA. COMPITE. DEMUESTRA LO QUE SABES.", intro: "Retos de fútbol para poner a prueba tus conocimientos y superar tus propias marcas.", playable: "Jugable ahora", playableText: "Prueba Adivina el jugador, Mayor o Menor, Adivina el Escudo y Modo Carrera. Hay más juegos en desarrollo.", gamesLink: "Ver todos los juegos →", scores: "Puntuaciones", scoresText: "No guardamos puntuaciones en una cuenta si juegas sin iniciar sesión. Crear una cuenta con Google es gratuito.", bug: "¿Has encontrado un fallo o tienes una sugerencia?", bugText: "Escríbenos qué ocurrió o qué te gustaría ver. Si puedes, incluye el juego, el navegador y una captura.", report: "Contactar por correo", back: "← Volver a los juegos" },
    legal: {
      eyebrow: "Información Beta",
      privacy: legalCopy.es.privacy, cookies: legalCopy.es.cookies, notice: { title: "Aviso legal", sections: [["", "10theGOAT es un proyecto de juegos de fútbol online actualmente en fase Beta."], ["Contenido", "Los nombres, marcas, escudos e imágenes de terceros pertenecen a sus respectivos titulares. Su presencia en la Beta tiene finalidad identificativa dentro de los juegos."], ["Disponibilidad", "Al tratarse de una Beta, funciones, puntuaciones, datos y reglas pueden cambiar, reiniciarse o dejar de estar disponibles durante el desarrollo."]] }
    },
    notFound: { title: "Fuera de juego.", body: "Esta página no existe o todavía no ha salido al campo.", back: "Volver al inicio" }
  },
  en: {
    languageName: "English", nav: { home: "Home", games: "Games", beta: "Beta", main: "Main navigation", legal: "Legal information", privacy: "Privacy", cookies: "Cookies", notice: "Legal notice", feedback: "Feedback", language: "Language" },
    meta: { title: "Online football games", description: "Online football games that put your knowledge to the test: Guess the Player, Higher or Lower, Guess the Badge and more.", shortDescription: "Put your football knowledge to the test with free challenges and mini-games." },
    home: { alt: "10theGOAT · Online football games", eyebrow: "10theGOAT Arena", title: "Football is played here too.", intro: "Choose your challenge, prove your football knowledge and beat your best score.", play: "Start playing", beta: "Explore games", version: "Arena", games: "Games", all: "View all" },
    catalog: { title: "All games" }, status: { available: "Available now", beta: "Available in Beta", soon: "Coming soon" },
    games: {
      higherLower: { title: "Higher or Lower", description: "Compare footballers' stats and build the longest streak you can.", meta: "Compare goals from real seasons and build the longest streak you can.", eyebrow: "Real stats · clubs", intro: "Compare real seasons. Decide whether the player on the right scored more or fewer goals than the player on the left and build your streak." },
      wordle: { title: "Guess the Player", description: "Football Wordle: six attempts to reveal the player's football name letter by letter.", meta: "Football Wordle: guess the player in six attempts.", eyebrow: "Football Wordle", intro: "Six attempts. A green letter is in the right place; a yellow one is in the name but in another position. Accents do not count." },
      grid: { title: "Football Grid", description: "Combine clubs, national teams and conditions to find valid players." }, career: { title: "Career Mode", description: "Create a player and simulate their full career, transfers, trophies, national team and legacy." }, eleven: { title: "My XI", description: "Build your ideal eleven with a budget, restrictions and player cards." },
      badge: { title: "Guess the Badge", description: "Identify the club from a heavily pixelated badge that becomes clearer after every attempt.", meta: "Identify the club as its badge is gradually revealed.", eyebrow: "Club badges", intro: "The badge starts almost unrecognisable. Each miss reduces the pixelation. You have six attempts to identify the club." },
      placeholder: { body: "This route is ready. The module will connect to the shared 10theGOAT data core.", label: "⚽ Module under construction" }
    },
    beta: { title: "PLAY. COMPETE. PROVE WHAT YOU KNOW.", intro: "Football challenges to test your knowledge and beat your own best marks.", playable: "Play now", playableText: "Try Guess the Player, Higher or Lower, Guess the Badge and Career Mode. More games are in development.", gamesLink: "View all games →", scores: "Scores", scoresText: "We do not save scores to an account when you play without signing in. Creating a Google account sign-in is free.", bug: "Found a bug or have a suggestion?", bugText: "Tell us what happened or what you would like to see. If possible, include the game, browser and a screenshot.", report: "Contact us by email", back: "← Back to games" },
    legal: { eyebrow: "Beta information", privacy: legalCopy.en.privacy, cookies: legalCopy.en.cookies, notice: { title: "Legal notice", sections: [["", "10theGOAT is an online football games project currently in Beta."], ["Content", "Third-party names, trademarks, badges and images belong to their respective owners. They appear in the Beta for identification within the games."], ["Availability", "As this is a Beta, features, scores, data and rules may change, reset or become unavailable during development."]] } },
    notFound: { title: "Offside.", body: "This page does not exist or has not taken the field yet.", back: "Back to home" }
  },
  fr: {
    languageName: "Français", nav: { home: "Accueil", games: "Jeux", beta: "Bêta", main: "Navigation principale", legal: "Informations légales", privacy: "Confidentialité", cookies: "Cookies", notice: "Mentions légales", feedback: "Avis", language: "Langue" },
    meta: { title: "Jeux de football en ligne", description: "Des jeux de football en ligne pour tester vos connaissances : Devinez le joueur, Plus ou Moins, Devinez l'écusson et plus encore.", shortDescription: "Testez vos connaissances du football avec des défis et mini-jeux gratuits." },
    home: { alt: "10theGOAT · Jeux de football en ligne", eyebrow: "10theGOAT Arena", title: "Ici aussi, on joue au football.", intro: "Choisissez votre défi, prouvez vos connaissances du football et battez votre meilleur score.", play: "Commencer à jouer", beta: "Explorer les jeux", version: "Arena", games: "Jeux", all: "Voir tout" },
    catalog: { title: "Tous les jeux" }, status: { available: "Disponible", beta: "Disponible en version Bêta", soon: "Bientôt disponible" },
    games: {
      higherLower: { title: "Plus ou Moins", description: "Comparez les statistiques des footballeurs et réalisez la plus longue série possible.", meta: "Comparez les buts de saisons réelles et réalisez la plus longue série possible.", eyebrow: "Statistiques réelles · clubs", intro: "Comparez des saisons réelles. Indiquez si le joueur de droite a marqué plus ou moins de buts que celui de gauche et construisez votre série." },
      wordle: { title: "Devinez le joueur", description: "Wordle football : six essais pour trouver le nom du joueur lettre par lettre.", meta: "Wordle football : trouvez le joueur en six essais.", eyebrow: "Wordle football", intro: "Six essais. Une lettre verte est bien placée ; une jaune figure dans le nom, mais ailleurs. Les accents ne comptent pas." },
      grid: { title: "Football Grid", description: "Croisez clubs, sélections et conditions pour trouver des joueurs valides." }, career: { title: "Mode Carrière", description: "Créez un joueur et simulez toute sa carrière, ses transferts, titres, sélections et son héritage." }, eleven: { title: "Mon XI", description: "Construisez votre onze idéal avec un budget, des contraintes et des cartes de joueurs." },
      badge: { title: "Devinez l'écusson", description: "Identifiez le club grâce à un écusson très pixelisé qui devient plus net à chaque essai.", meta: "Identifiez le club à mesure que son écusson se dévoile.", eyebrow: "Écussons de clubs", intro: "L'écusson est presque méconnaissable au départ. Chaque erreur réduit la pixellisation. Vous avez six essais pour trouver le club." },
      placeholder: { body: "Cette route est prête. Ce module sera connecté au socle de données commun de 10theGOAT.", label: "⚽ Module en construction" }
    },
    beta: { title: "JOUEZ. CONFRONTEZ-VOUS. MONTREZ CE QUE VOUS SAVEZ.", intro: "Des défis de football pour tester vos connaissances et battre vos propres records.", playable: "Jouez maintenant", playableText: "Essayez Devinez le joueur, Plus ou Moins, Devinez l’écusson et le Mode Carrière. D’autres jeux sont en développement.", gamesLink: "Voir tous les jeux →", scores: "Scores", scoresText: "Nous n’enregistrons pas les scores dans un compte si vous jouez sans vous connecter. La connexion avec Google est gratuite.", bug: "Vous avez trouvé un bug ou avez une suggestion ?", bugText: "Dites-nous ce qui s’est passé ou ce que vous aimeriez voir. Si possible, indiquez le jeu, le navigateur et joignez une capture.", report: "Nous contacter par e-mail", back: "← Retour aux jeux" },
    legal: { eyebrow: "Informations Bêta", privacy: legalCopy.fr.privacy, cookies: legalCopy.fr.cookies, notice: { title: "Mentions légales", sections: [["", "10theGOAT est un projet de jeux de football en ligne actuellement en Bêta."], ["Contenu", "Les noms, marques, écussons et images de tiers appartiennent à leurs propriétaires respectifs. Leur présence dans la Bêta sert à l'identification au sein des jeux."], ["Disponibilité", "Cette version étant une Bêta, les fonctionnalités, scores, données et règles peuvent évoluer, être réinitialisés ou devenir indisponibles pendant le développement."]] } },
    notFound: { title: "Hors-jeu.", body: "Cette page n'existe pas ou n'est pas encore entrée sur le terrain.", back: "Retour à l'accueil" }
  },
} as const;

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? readonly Widen<U>[] : T extends object ? { readonly [K in keyof T]: Widen<T[K]> } : T;
export type Dictionary = Widen<(typeof dictionaries)["es"]>;
