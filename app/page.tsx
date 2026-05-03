"use client";

export const dynamic = "force-dynamic";

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
  const[cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Форма
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [example, setExample] = useState("");

  // Тренировка
  const[trainIndex, setTrainIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Статистика
  const [sessionRemember, setSessionRemember] = useState(0);
  const [sessionForgot, setSessionForgot] = useState(0);

  useEffect(() => {
    setMounted(true);
  },[]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("flashcards").select("*").order("created_at", { ascending: false });
    if (data) setCards(data);
    setLoading(false);
  },[]);

  const fetchDueCards = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    
    // 1. Получаем карточки из базы
    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .lte("next_review", now);

    if (!error && data) {
      // 2. Алгоритм Фишера-Йетса (Перемешиваем карточки)
      const shuffled =[...data];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setDueCards(shuffled);
      setTrainIndex(0);
      setShowAnswer(false);
      setSessionRemember(0);
      setSessionForgot(0);
    }
    setLoading(false);
  },[]);

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

  // ОСНОВНАЯ ЛОГИКА АЛГОРИТМА ANKI
  const handleReview = async (remember: boolean) => {
    const card = dueCards[trainIndex];
    
    let newBox = card.box;
    let newStreak = card.box_1_streak || 0;
    let daysToAdd = 1;
    let repeatInSession = false; // Флаг: нужно ли повторить в этой сессии?

    if (!remember) {
      // Если забыл: сбрасываем в ящик 1, стрик 0, повторяем прямо сейчас
      newBox = 1; 
      newStreak = 0; 
      daysToAdd = 0; 
      repeatInSession = true;
    } else {
      if (newBox === 1) {
        if (newStreak === 0) {
          // Если угадал первый раз: стрик 1, повторяем прямо сейчас
          newStreak = 1; 
          daysToAdd = 0; 
          repeatInSession = true;
        } else {
          // Если угадал второй раз: переносим в ящик 2 на 3 дня
          newBox = 2; 
          newStreak = 0; 
          daysToAdd = 3; 
        }
      } else if (newBox === 2) { newBox = 3; daysToAdd = 7; }
      else if (newBox === 3) { newBox = 4; daysToAdd = 14; }
      else { newBox = 5; daysToAdd = 30; }
    }

    const nextR = new Date();
    nextR.setDate(nextR.getDate() + daysToAdd);

    // 1. Сохраняем прогресс в базу данных
    await supabase.from("flashcards").update({ 
      box: newBox, 
      box_1_streak: newStreak, 
      next_review: nextR.toISOString() 
    }).eq("id", card.id);

    // 2. Если карточку нужно повторить (ошибка или первый шаг), кидаем в конец очереди!
    if (repeatInSession) {
      setDueCards(prev =>[...prev, { ...card, box: newBox, box_1_streak: newStreak }]);
    }

    // 3. Обновляем статистику текущей тренировки
    if (remember) setSessionRemember(prev => prev + 1);
    else setSessionForgot(prev => prev + 1);

    // 4. Переходим к следующей карточке
    setTrainIndex(prev => prev + 1);
    setShowAnswer(false);
  };

  if (!mounted) return null;

  // Динамический счетчик для вкладки (показывает сколько реально осталось в сессии)
  const dueCountText = activeTab === "training" 
    ? dueCards.length - trainIndex 
    : cards.filter(c => new Date(c.next_review) <= new Date()).length;

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
        .fin { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Dela Gothic One', sans-serif", textAlign: "center", marginBottom: 24, color: "#1a1a1a" }}>
          МОЙ <span style={{ color: "#2563eb" }}>СЛОВАРЬ</span>
        </h1>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
          <button className={`tab-btn ${activeTab === "dictionary" ? "active" : ""}`} onClick={() => setActiveTab("dictionary")}>Словарь</button>
          <button className={`tab-btn ${activeTab === "training" ? "active" : ""}`} onClick={() => setActiveTab("training")}>Тренировка ({dueCountText})</button>
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
              <div className="card fin">
                <h2 style={{ fontFamily: "'Dela Gothic One', sans-serif" }}>Всё готово! 🎉</h2>
                <p style={{ margin: "10px 0 5px", color: "#666" }}>Вы отлично поработали!</p>
                <p style={{ fontSize: "14px", color: "#888", marginBottom: "20px" }}>
                  Результат сессии: Успешно: {sessionRemember} | Ошибок: {sessionForgot}
                </p>
                <button className="primary-btn" onClick={fetchDueCards}>Проверить новые</button>
              </div>
            ) : (
              <div className="card" style={{ minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", top: 20, left: 20 }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="box-dot" style={{ background: i <= dueCards[trainIndex].box ? "#2563eb" : "#eee" }} />
                  ))}
                </div>
                
                {/* Если это первый шаг первого ящика, показываем маленькую подсказку */}
                {dueCards[trainIndex].box === 1 && dueCards[trainIndex].box_1_streak === 0 && (
                  <span style={{ position: "absolute", top: 20, right: 20, fontSize: 11, color: "#999", background: "#f5f5f5", padding: "4px 8px", borderRadius: 10 }}>
                    Новое слово (шаг 1/2)
                  </span>
                )}
                {dueCards[trainIndex].box === 1 && dueCards[trainIndex].box_1_streak === 1 && (
                  <span style={{ position: "absolute", top: 20, right: 20, fontSize: 11, color: "#ca8a04", background: "#fefce8", padding: "4px 8px", borderRadius: 10 }}>
                    Закрепление (шаг 2/2)
                  </span>
                )}

                <h2 style={{ fontSize: 42, fontFamily: "'Dela Gothic One', sans-serif", margin: "40px 0" }}>{dueCards[trainIndex].word}</h2>
                
                {showAnswer ? (
                  <div className="fin">
                    <p style={{ fontSize: 24, color: "#2563eb", fontWeight: "bold", marginBottom: 10 }}>{dueCards[trainIndex].translation}</p>
                    <p style={{ fontStyle: "italic", color: "#888", marginBottom: 30 }}>{dueCards[trainIndex].example}</p>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => handleReview(false)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #ffcccb", background: "#fff5f5", color: "#dc2626", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#fee2e2"} onMouseOut={e => e.currentTarget.style.background = "#fff5f5"}>Забыл</button>
                      <button onClick={() => handleReview(true)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#dcfce7"} onMouseOut={e => e.currentTarget.style.background = "#f0fdf4"}>Помню</button>
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
          <div className="card fin">
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