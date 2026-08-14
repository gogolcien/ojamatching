import { useCallback, useEffect, useState } from "react";
import { loadFullTournament } from "./repo";

// Carga el torneo completo (datos + jugadores + rondas) y expone una
// función reload() para refrescar después de cualquier cambio.
export function useTournament(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const full = await loadFullTournament(id);
    setData(full);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}
