import { useCallback, useEffect, useRef, useState } from "react";

import api from "@/services/api";

export type Item = { id: number; name: string };
export type ListState = { status: "idle" | "loading" | "error" | "ready"; items: Item[]; parentId: number | null };
const IDLE: ListState = { status: "idle", items: [], parentId: null };
const sortItems = (a: Item[]) => [...a].sort((x, y) => x.name.localeCompare(y.name));

/** Progressive state -> board -> class lists. Late responses are discarded by parent id + token. */
export function useCatalogue() {
  const [states, setStates] = useState<ListState>({ status: "loading", items: [], parentId: null });
  const [boards, setBoards] = useState<ListState>(IDLE);
  const [classes, setClasses] = useState<ListState>(IDLE);
  const [stateId, setStateId] = useState<number | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const tok = useRef({ states: 0, boards: 0, classes: 0 });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadStates = useCallback(() => {
    const t = ++tok.current.states;
    setStates({ status: "loading", items: [], parentId: null });
    api.data.getStates().then((d) => {
      if (alive.current && t === tok.current.states) setStates({ status: "ready", items: sortItems(d), parentId: null });
    }).catch(() => {
      if (alive.current && t === tok.current.states) setStates({ status: "error", items: [], parentId: null });
    });
  }, []);
  useEffect(() => { loadStates(); }, [loadStates]);

  const loadBoards = useCallback((sid: number) => {
    const t = ++tok.current.boards;
    setBoards({ status: "loading", items: [], parentId: sid });
    api.data.getBoards(sid).then((d) => {
      if (alive.current && t === tok.current.boards) setBoards({ status: "ready", items: sortItems(d), parentId: sid });
    }).catch(() => {
      if (alive.current && t === tok.current.boards) setBoards({ status: "error", items: [], parentId: sid });
    });
  }, []);

  const loadClasses = useCallback((bid: number) => {
    const t = ++tok.current.classes;
    setClasses({ status: "loading", items: [], parentId: bid });
    api.data.getClasses(bid).then((d) => {
      if (alive.current && t === tok.current.classes) setClasses({ status: "ready", items: sortItems(d), parentId: bid });
    }).catch(() => {
      if (alive.current && t === tok.current.classes) setClasses({ status: "error", items: [], parentId: bid });
    });
  }, []);

  const selectState = useCallback((id: number) => {
    tok.current.classes++;
    setStateId(id); setBoardId(null); setClassId(null); setClasses(IDLE);
    loadBoards(id);
  }, [loadBoards]);
  const selectBoard = useCallback((id: number) => {
    setBoardId(id); setClassId(null);
    loadClasses(id);
  }, [loadClasses]);
  const retryBoards = useCallback(() => { if (stateId !== null) loadBoards(stateId); }, [stateId, loadBoards]);
  const retryClasses = useCallback(() => { if (boardId !== null) loadClasses(boardId); }, [boardId, loadClasses]);

  return { states, boards, classes, stateId, boardId, classId, setClassId, selectState, selectBoard, loadStates, retryBoards, retryClasses };
}
