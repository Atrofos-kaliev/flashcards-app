"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";

type Flashcard = {
  id: string;
  word: string;
  translation: string;
  example: string;
  box: number;
  next_review: string;
  box_1_streak: number;
};

type Tab = "dictionary" | "training" | "stats";

const BOX_LABELS: Record<number, string> = { 1: "Ящик 1", 2: "Ящик 2", 3: "Ящик 3", 4: "Ящик 4", 5: "Выучено" };
const BOX_COLORS: Record<number, string> = { 1: "#dc2626", 2: "#ea580c", 3: "#ca8a04", 4: "#16a34a", 5: "#2563eb" };

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("dictionary");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Форма
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [example, setExample] = useState("");

  // Тренировка
  const [trainIndex, setTrainIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("flashcards").select("*").order("created_at", { ascending: false });
    if (data) setCards(data);
    setLoading(false);
  }, []);

  const fetchDueCards = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase.from("flashcards").select("*").lte("next_review", now).order("next_review", { ascending: true });
    if (data) {
      setDueCards(data);
      setTrainIndex(0);
      setShowAnswer(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (activeTab === "dictionary" || activeTab === "stats") fetchCards();
      if (activeTab === "training") fetchDueCards();
    }
  }, [activeTab, mounted, fetchCards, fetchDueCards]);

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !translation.trim()) return;
    const { data } = await supabase.from("flashcards").insert([{ word, translation, example }]).select();
    if (data) {
      setCards(prev => [data[0], ...prev]);
      setWord(""); setTranslation(""); setExample("");
    }
  };

  const deleteCard = async (id: string) => {
    await supabase.from("flashcards").delete().eq("id", id);
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const handleReview = async (remember: boolean) => {
    const card = dueCards[trainIndex];
    let newBox = remember ? Math.min(card.box + 1, 5) : 1;
    let days = newBox === 1 ? 1 : newBox === 2 ? 3 : newBox === 3 ? 7 : newBox === 4 ? 14 : 30;
    
    const nextR = new Date();
    nextR.setDate(nextR.getDate() + days);

    await supabase.from("flashcards").update({ box: newBox, next_review: nextR.toISOString() }).eq("id", card.id);
    setTrainIndex(prev => prev + 1);
    setShowAnswer(false);
  };

  if (!mounted) return null;

  const dueCount = cards.filter(c => new Date(c.next_review) <= new Date()).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ee", padding: "20px 16px", fontFamily: "sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:wght@400;500;700&display=swap');
        .card { background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 24px; margin-bottom: 16px; border: 1px solid rgba(0,0,0,0.05); }
        .tab-btn { padding: 10px 20px; cursor: pointer; border: none; background: none; font-family: 'DM Sans', sans-serif; font-weight: 500; color: #888; transition: 0.2s; }
        .tab-btn.active { color: #2563eb; border-bottom: 2px solid #2563eb; }
        .input-field { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; outline: none; }
        .input-field:focus { border-color: #2563eb; }
        .primary-btn { background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; }
        .box-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Dela Gothic One', sans-serif", textAlign: "center", marginBottom: 24, color: "#1a1a1a" }}>
          МОЙ <span style={{ color: "#2563eb" }}>СЛОВАРЬ</span>
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
          <button className={`tab-btn ${activeTab === "dictionary" ? "active" : ""}`} onClick={() => setActiveTab("dictionary")}>Словарь</button>
          <button className={`tab-btn ${activeTab === "training" ? "active" : ""}`} onClick={() => setActiveTab("training")}>Тренировка ({dueCount})</button>
          <button className={`tab-btn ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Прогресс</button>
        </div>

        {activeTab === "dictionary" && (
          <div className="fin">
            <form onSubmit={addCard} className="card">
              <div style={{ display: "flex", gap: 10 }}>
                <input className="input-field" placeholder="Слово" value={word} onChange={e => setWord(e.target.value)} required />
                <input className="input-field" placeholder="Перевод" value={translation} onChange={e => setTranslation(e.target.value)} required />
              </div>
              <input className="input-field" placeholder="Пример (необязательно)" value={example} onChange={e => setExample(e.target.value)} />
              <button type="submit" className="primary-btn">Добавить слово</button>
            </form>

            {loading ? <p style={{ textAlign: "center" }}>Загрузка...</p> : (
              <div>
                {cards.map(c => (
                  <div key={c.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 18 }}>{c.word}</div>
                      <div style={{ color: "#666" }}>{c.translation}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: "bold", color: BOX_COLORS[c.box] }}>{BOX_LABELS[c.box]}</span>
                      <button onClick={() => deleteCard(c.id)} style={{ color: "#ff4d4d", border: "none", background: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "training" && (
          <div style={{ textAlign: "center" }}>
            {trainIndex >= dueCards.length ? (
              <div className="card">
                <h2 style={{ fontFamily: "'Dela Gothic One', sans-serif" }}>Всё готово! 🎉</h2>
                <p style={{ margin: "10px 0 20px", color: "#666" }}>Вы повторили все запланированные слова.</p>
                <button className="primary-btn" onClick={fetchDueCards}>Начать заново</button>
              </div>
            ) : (
              <div className="card" style={{ minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", top: 20, left: 20 }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="box-dot" style={{ background: i <= dueCards[trainIndex].box ? "#2563eb" : "#eee" }} />
                  ))}
                </div>
                <h2 style={{ fontSize: 42, fontFamily: "'Dela Gothic One', sans-serif", margin: "40px 0" }}>{dueCards[trainIndex].word}</h2>
                
                {showAnswer ? (
                  <div className="fin">
                    <p style={{ fontSize: 24, color: "#2563eb", fontWeight: "bold", marginBottom: 10 }}>{dueCards[trainIndex].translation}</p>
                    <p style={{ fontStyle: "italic", color: "#888", marginBottom: 30 }}>{dueCards[trainIndex].example}</p>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => handleReview(false)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #ffcccb", background: "#fff5f5", color: "#dc2626", fontWeight: "bold", cursor: "pointer" }}>Забыл</button>
                      <button onClick={() => handleReview(true)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontWeight: "bold", cursor: "pointer" }}>Помню</button>
                    </div>
                  </div>
                ) : (
                  <button className="primary-btn" style={{ marginTop: "auto" }} onClick={() => setShowAnswer(true)}>Показать ответ</button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontWeight: "bold" }}>Ваш прогресс</h3>
            {[1,2,3,4,5].map(b => {
              const count = cards.filter(c => c.box === b).length;
              const percent = cards.length > 0 ? (count / cards.length) * 100 : 0;
              return (
                <div key={b} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{BOX_LABELS[b]}</span>
                    <span style={{ fontWeight: "bold" }}>{count} слов</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: BOX_COLORS[b], width: `${percent}%`, transition: "0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 