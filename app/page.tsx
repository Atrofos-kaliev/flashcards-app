"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

type Flashcard = {
  id: string;
  word: string;
  translation: string;
  example: string;
  box: number;
  next_review: string;
  box_1_streak: number;
};

type FlashcardForm = {
  word: string;
  translation: string;
  example: string;
};

type Tab = "dictionary" | "training" | "stats" | "admin";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

const BOX_LABELS: Record<number, string> = { 1: "Ящик 1", 2: "Ящик 2", 3: "Ящик 3", 4: "Ящик 4", 5: "Выучено" };
const BOX_COLORS: Record<number, string> = { 1: "#dc2626", 2: "#ea580c", 3: "#ca8a04", 4: "#16a34a", 5: "#2563eb" };
const EMPTY_FORM: FlashcardForm = { word: "", translation: "", example: "" };

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dictionary");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [newCard, setNewCard] = useState<FlashcardForm>(EMPTY_FORM);
  const [editCard, setEditCard] = useState<FlashcardForm>(EMPTY_FORM);
  const [passwordInput, setPasswordInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [trainIndex, setTrainIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const [sessionRemember, setSessionRemember] = useState(0);
  const [sessionForgot, setSessionForgot] = useState(0);

  const isAdminUnlocked = Boolean(adminPassword);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/flashcards");
      const result: ApiResponse<Flashcard[]> = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось загрузить карточки.");
      }

      setCards(result.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить карточки.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDueCards = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/flashcards?due=1");
      const result: ApiResponse<Flashcard[]> = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось загрузить тренировку.");
      }

      const shuffled = [...(result.data ?? [])];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setDueCards(shuffled);
      setTrainIndex(0);
      setShowAnswer(false);
      setSessionRemember(0);
      setSessionForgot(0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить тренировку.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void (activeTab === "training" ? fetchDueCards() : fetchCards());
    });
  }, [activeTab, fetchCards, fetchDueCards]);

  const adminHeaders = () => ({
    "Content-Type": "application/json",
    "x-admin-password": adminPassword,
  });

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!passwordInput.trim()) {
      setErrorMessage("Введите пароль.");
      return;
    }

    setIsUnlocking(true);

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "x-admin-password": passwordInput },
      });
      const result: ApiResponse<never> = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось проверить пароль.");
      }

      setAdminPassword(passwordInput);
      setPasswordInput("");
      setSuccessMessage("Управление открыто.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось проверить пароль.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnauthorized = () => {
    setAdminPassword("");
    setPasswordInput("");
    setErrorMessage("Неверный пароль. Введите пароль заново.");
  };

  const addCard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCard.word.trim() || !newCard.translation.trim() || isSubmitting || !isAdminUnlocked) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(newCard),
      });
      const result: ApiResponse<Flashcard> = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !result.data) {
        throw new Error(result.error || "Не удалось добавить карточку.");
      }

      setCards(prev => [result.data as Flashcard, ...prev]);
      setNewCard(EMPTY_FORM);
      setSuccessMessage("Слово добавлено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось добавить карточку.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (card: Flashcard) => {
    setEditingId(card.id);
    setEditCard({ word: card.word, translation: card.translation, example: card.example || "" });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCard(EMPTY_FORM);
  };

  const saveCard = async (id: string) => {
    if (!editCard.word.trim() || !editCard.translation.trim() || savingId || !isAdminUnlocked) return;

    setSavingId(id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify(editCard),
      });
      const result: ApiResponse<Flashcard> = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !result.data) {
        throw new Error(result.error || "Не удалось сохранить карточку.");
      }

      setCards(prev => prev.map(card => (card.id === id ? result.data as Flashcard : card)));
      cancelEditing();
      setSuccessMessage("Слово обновлено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить карточку.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteCard = async (id: string) => {
    if (deletingId || !isAdminUnlocked) return;

    setDeletingId(id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      const result: ApiResponse<never> = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Не удалось удалить карточку.");
      }

      setCards(prev => prev.filter(card => card.id !== id));
      setDueCards(prev => prev.filter(card => card.id !== id));
      if (editingId === id) cancelEditing();
      setSuccessMessage("Слово удалено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить карточку.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReview = async (remember: boolean) => {
    if (isReviewing) return;

    const card = dueCards[trainIndex];

    if (!card) {
      setShowAnswer(false);
      return;
    }

    setIsReviewing(true);
    setErrorMessage("");

    let newBox = card.box;
    let newStreak = card.box_1_streak || 0;
    let daysToAdd = 1;
    let repeatInSession = false;

    if (!remember) {
      newBox = 1;
      newStreak = 0;
      daysToAdd = 0;
      repeatInSession = true;
    } else {
      if (newBox === 1) {
        if (newStreak === 0) {
          newStreak = 1;
          daysToAdd = 0;
          repeatInSession = true;
        } else {
          newBox = 2;
          newStreak = 0;
          daysToAdd = 3;
        }
      } else if (newBox === 2) {
        newBox = 3;
        daysToAdd = 7;
      } else if (newBox === 3) {
        newBox = 4;
        daysToAdd = 14;
      } else {
        newBox = 5;
        daysToAdd = 30;
      }
    }

    const nextR = new Date();
    nextR.setDate(nextR.getDate() + daysToAdd);

    try {
      const response = await fetch(`/api/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          box: newBox,
          box_1_streak: newStreak,
          next_review: nextR.toISOString(),
        }),
      });
      const result: ApiResponse<never> = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось сохранить результат тренировки.");
      }

      // Box 1 requires two successful answers in one session before advancing.
      if (repeatInSession) {
        setDueCards(prev => [...prev, { ...card, box: newBox, box_1_streak: newStreak, next_review: nextR.toISOString() }]);
      }

      if (remember) setSessionRemember(prev => prev + 1);
      else setSessionForgot(prev => prev + 1);

      setTrainIndex(prev => prev + 1);
      setShowAnswer(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить результат тренировки.");
    } finally {
      setIsReviewing(false);
    }
  };

  const currentCard = dueCards[trainIndex];
  const dueCountText = activeTab === "training"
    ? Math.max(dueCards.length - trainIndex, 0)
    : cards.filter(card => new Date(card.next_review) <= new Date()).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ee", padding: "20px 16px", fontFamily: "sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:wght@400;500;700&display=swap');
        .card { background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 24px; margin-bottom: 16px; border: 1px solid rgba(0,0,0,0.05); }
        .tab-btn { padding: 10px 14px; cursor: pointer; border: none; background: none; font-family: 'DM Sans', sans-serif; font-weight: 500; color: #888; transition: 0.2s; }
        .tab-btn.active { color: #2563eb; border-bottom: 2px solid #2563eb; }
        .input-field { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: #2563eb; }
        .primary-btn { background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; }
        .primary-btn:disabled { opacity: 0.65; cursor: default; }
        .secondary-btn { border: 1px solid #d1d5db; background: white; color: #374151; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; }
        .danger-btn { border: none; background: none; color: #dc2626; cursor: pointer; font-weight: 700; }
        .box-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
        .fin { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 520px) {
          .tabs { overflow-x: auto; justify-content: flex-start !important; }
          .field-row { flex-direction: column; gap: 0 !important; }
          .word-row { align-items: flex-start !important; flex-direction: column; }
          .word-actions { width: 100%; justify-content: space-between; }
        }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Dela Gothic One', sans-serif", textAlign: "center", marginBottom: 24, color: "#1a1a1a" }}>
          МОЙ <span style={{ color: "#2563eb" }}>СЛОВАРЬ</span>
        </h1>

        <div className="tabs" style={{ display: "flex", justifyContent: "center", marginBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
          <button className={`tab-btn ${activeTab === "dictionary" ? "active" : ""}`} onClick={() => setActiveTab("dictionary")}>Словарь</button>
          <button className={`tab-btn ${activeTab === "training" ? "active" : ""}`} onClick={() => setActiveTab("training")}>Тренировка ({dueCountText})</button>
          <button className={`tab-btn ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Прогресс</button>
          <button className={`tab-btn ${activeTab === "admin" ? "active" : ""}`} onClick={() => setActiveTab("admin")}>Управление</button>
        </div>

        {errorMessage && <p style={{ color: "#dc2626", textAlign: "center", marginBottom: 16 }}>{errorMessage}</p>}
        {successMessage && <p style={{ color: "#16a34a", textAlign: "center", marginBottom: 16 }}>{successMessage}</p>}

        {activeTab === "dictionary" && (
          <div className="fin">
            {loading ? <p style={{ textAlign: "center" }}>Загрузка...</p> : (
              <div>
                {cards.length === 0 && <div className="card" style={{ textAlign: "center", color: "#666" }}>Пока нет слов.</div>}
                {cards.map(card => (
                  <div key={card.id} className="card word-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 18 }}>{card.word}</div>
                      <div style={{ color: "#666" }}>{card.translation}</div>
                      {card.example && <div style={{ color: "#888", fontStyle: "italic", marginTop: 4 }}>{card.example}</div>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: "bold", color: BOX_COLORS[card.box] }}>{BOX_LABELS[card.box]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "admin" && (
          <div className="fin">
            {!isAdminUnlocked ? (
              <form onSubmit={handleAdminLogin} className="card">
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Доступ к управлению</h3>
                <input
                  className="input-field"
                  placeholder="Пароль"
                  type="password"
                  value={passwordInput}
                  onChange={event => setPasswordInput(event.target.value)}
                  autoComplete="current-password"
                />
                <button type="submit" className="primary-btn" disabled={isUnlocking}>{isUnlocking ? "Проверяем..." : "Открыть управление"}</button>
              </form>
            ) : (
              <>
                <form onSubmit={addCard} className="card">
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>Добавить слово</h3>
                  <div className="field-row" style={{ display: "flex", gap: 10 }}>
                    <input className="input-field" placeholder="Слово" value={newCard.word} onChange={event => setNewCard(prev => ({ ...prev, word: event.target.value }))} required />
                    <input className="input-field" placeholder="Перевод" value={newCard.translation} onChange={event => setNewCard(prev => ({ ...prev, translation: event.target.value }))} required />
                  </div>
                  <input className="input-field" placeholder="Пример (необязательно)" value={newCard.example} onChange={event => setNewCard(prev => ({ ...prev, example: event.target.value }))} />
                  <button type="submit" className="primary-btn" disabled={isSubmitting}>{isSubmitting ? "Добавляем..." : "Добавить слово"}</button>
                </form>

                {loading ? <p style={{ textAlign: "center" }}>Загрузка...</p> : (
                  <div>
                    {cards.length === 0 && <div className="card" style={{ textAlign: "center", color: "#666" }}>Пока нет слов для управления.</div>}
                    {cards.map(card => (
                      <div key={card.id} className="card" style={{ padding: "16px 20px" }}>
                        {editingId === card.id ? (
                          <div>
                            <div className="field-row" style={{ display: "flex", gap: 10 }}>
                              <input className="input-field" placeholder="Слово" value={editCard.word} onChange={event => setEditCard(prev => ({ ...prev, word: event.target.value }))} required />
                              <input className="input-field" placeholder="Перевод" value={editCard.translation} onChange={event => setEditCard(prev => ({ ...prev, translation: event.target.value }))} required />
                            </div>
                            <input className="input-field" placeholder="Пример (необязательно)" value={editCard.example} onChange={event => setEditCard(prev => ({ ...prev, example: event.target.value }))} />
                            <div style={{ display: "flex", gap: 10 }}>
                              <button type="button" className="primary-btn" disabled={savingId === card.id} onClick={() => saveCard(card.id)}>{savingId === card.id ? "Сохраняем..." : "Сохранить"}</button>
                              <button type="button" className="secondary-btn" onClick={cancelEditing}>Отмена</button>
                            </div>
                          </div>
                        ) : (
                          <div className="word-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: "bold", fontSize: 18 }}>{card.word}</div>
                              <div style={{ color: "#666" }}>{card.translation}</div>
                              {card.example && <div style={{ color: "#888", fontStyle: "italic", marginTop: 4 }}>{card.example}</div>}
                              <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: "bold", color: BOX_COLORS[card.box] }}>{BOX_LABELS[card.box]}</span>
                            </div>
                            <div className="word-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button type="button" className="secondary-btn" onClick={() => startEditing(card)}>Редактировать</button>
                              <button type="button" className="danger-btn" disabled={deletingId === card.id} onClick={() => deleteCard(card.id)}>{deletingId === card.id ? "Удаляем..." : "Удалить"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "training" && (
          <div style={{ textAlign: "center" }}>
            {!currentCard ? (
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
                  {[1, 2, 3, 4, 5].map(index => (
                    <span key={index} className="box-dot" style={{ background: index <= currentCard.box ? "#2563eb" : "#eee" }} />
                  ))}
                </div>

                {currentCard.box === 1 && currentCard.box_1_streak === 0 && (
                  <span style={{ position: "absolute", top: 20, right: 20, fontSize: 11, color: "#999", background: "#f5f5f5", padding: "4px 8px", borderRadius: 10 }}>
                    Новое слово (шаг 1/2)
                  </span>
                )}
                {currentCard.box === 1 && currentCard.box_1_streak === 1 && (
                  <span style={{ position: "absolute", top: 20, right: 20, fontSize: 11, color: "#ca8a04", background: "#fefce8", padding: "4px 8px", borderRadius: 10 }}>
                    Закрепление (шаг 2/2)
                  </span>
                )}

                <h2 style={{ fontSize: 42, fontFamily: "'Dela Gothic One', sans-serif", margin: "40px 0" }}>{currentCard.word}</h2>

                {showAnswer ? (
                  <div className="fin">
                    <p style={{ fontSize: 24, color: "#2563eb", fontWeight: "bold", marginBottom: 10 }}>{currentCard.translation}</p>
                    <p style={{ fontStyle: "italic", color: "#888", marginBottom: 30 }}>{currentCard.example}</p>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button disabled={isReviewing} onClick={() => handleReview(false)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #ffcccb", background: "#fff5f5", color: "#dc2626", fontWeight: "bold", cursor: isReviewing ? "default" : "pointer", transition: "0.2s" }} onMouseOver={event => { if (!isReviewing) event.currentTarget.style.background = "#fee2e2"; }} onMouseOut={event => { event.currentTarget.style.background = "#fff5f5"; }}>Забыл</button>
                      <button disabled={isReviewing} onClick={() => handleReview(true)} style={{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontWeight: "bold", cursor: isReviewing ? "default" : "pointer", transition: "0.2s" }} onMouseOver={event => { if (!isReviewing) event.currentTarget.style.background = "#dcfce7"; }} onMouseOut={event => { event.currentTarget.style.background = "#f0fdf4"; }}>Помню</button>
                    </div>
                  </div>
                ) : (
                  <button className="primary-btn" style={{ marginTop: "auto" }} disabled={isReviewing} onClick={() => setShowAnswer(true)}>Показать ответ</button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="card fin">
            <h3 style={{ marginBottom: 20, fontWeight: "bold" }}>Ваш прогресс</h3>
            {[1, 2, 3, 4, 5].map(box => {
              const count = cards.filter(card => card.box === box).length;
              const percent = cards.length > 0 ? (count / cards.length) * 100 : 0;
              return (
                <div key={box} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{BOX_LABELS[box]}</span>
                    <span style={{ fontWeight: "bold" }}>{count} слов</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: BOX_COLORS[box], width: `${percent}%`, transition: "0.5s ease" }} />
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
