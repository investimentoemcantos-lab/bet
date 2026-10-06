import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib";
import type { Match, WatchMatch } from "./types";
export function useWatchlist(userId: string) {
  const [items, setItems] = useState<WatchMatch[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void supabase
      .from("bet_sports_watchlist")
      .select("match_data,notes,created_at,is_favorite")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted.current) return;
        if (error) setError("Não foi possível carregar seus favoritos.");
        else
          setItems(
            (data || []).map((r) => ({
              match: r.match_data as Match,
              note: r.notes,
              savedAt: r.created_at,
              favorite: r.is_favorite,
            })),
          );
      });
    return () => {
      mounted.current = false;
    };
  }, [userId]);
  async function toggle(match: Match) {
    if (busy) return;
    setBusy(true);
    setError("");
    const existing = items.find((w) => w.match.id === match.id);
    const favorite = !existing || existing.favorite === false;
    const { error } = await supabase.from("bet_sports_watchlist").upsert(
      {
        user_id: userId,
        fixture_id: match.id,
        match_data: match,
        is_favorite: favorite,
      },
      { onConflict: "user_id,fixture_id" },
    );
    if (mounted.current) {
      if (error) setError("Não foi possível salvar seus favoritos.");
      else
        setItems((old) => [
          {
            match,
            note: existing?.note || "",
            favorite,
            savedAt: existing?.savedAt || new Date().toISOString(),
          },
          ...old.filter((w) => w.match.id !== match.id),
        ]);
      setBusy(false);
    }
  }
  async function saveNote(match: Match, note: string) {
    setError("");
    const { error } = await supabase.from("bet_sports_watchlist").upsert(
      {
        user_id: userId,
        fixture_id: match.id,
        match_data: match,
        notes: note,
        is_favorite: true,
      },
      { onConflict: "user_id,fixture_id" },
    );
    if (error) {
      setError("Não foi possível salvar a análise.");
      return false;
    }
    if (mounted.current)
      setItems((old) => [
        { match, note, favorite: true, savedAt: new Date().toISOString() },
        ...old.filter((w) => w.match.id !== match.id),
      ]);
    return true;
  }
  return {
    items: items.filter((w) => w.favorite !== false),
    notes: Object.fromEntries(items.map((w) => [w.match.id, w.note])),
    error,
    busy,
    toggle,
    saveNote,
  };
}
