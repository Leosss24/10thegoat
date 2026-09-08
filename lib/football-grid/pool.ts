// Career categories select the axes; live squad snapshots select current players.
export const GRID_CATEGORIES = ['premium_international','elite_international'] as const;
export const GRID_EUROPE = ['Spain','England','Germany','Italy','France','Portugal','Netherlands','Turkey'] as const;
// Explicitly agreed with the user; scope this addition to Football Grid.
export const GRID_LEGEND_ADDITIONS = [{id:1,apiId:154,name:'Lionel Messi'}] as const;
export function isGridCategory(value: string | undefined) { return GRID_CATEGORIES.some(c=>c===value); }
export function isGridEuropeanCountry(value: string | undefined) { return GRID_EUROPE.some(c=>c===value); }
