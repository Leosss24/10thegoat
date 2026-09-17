'use client';
import { useEffect,useState } from 'react';
import { badgeSnapshot,subscribeBadges } from '../../lib/badges/client';
export function useBadges(){const [snapshot,setSnapshot]=useState(badgeSnapshot);useEffect(()=>{const update=()=>setSnapshot(badgeSnapshot());const off=subscribeBadges(update);update();return off;},[]);return snapshot;}
