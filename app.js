import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Supabase init
const supabase = createClient(
  "https://zfutomavbjmxonyfjlhm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdXRvbWF2YmpteG9ueWZqbGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NjE0MjcsImV4cCI6MjA2NjIzNzQyN30.bnAVd6t_Jgmr-2u3j1hLZCiunTn6S1PNgizp_e3Yppo"
);

// ✅ DOM Ready
document.addEventListener("DOMContentLoaded", async () => {
  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) return (window.location.href = "login.html");
  const userEmail = sessionRes.data.session.user.email;

  // 👤 Username setup
  let username = userEmail.split("@")[0].split(/[._]/)[0];
  username = username.replace(/^\w/, c => c.toUpperCase());
  document.getElementById("username").textContent = username;

  // DOM Elements
  const questionDisplay = document.querySelector(".question-display");
  const answerInput = document.getElementById("answerInput");
  const submitBtn = document.getElementById("submitBtn");
  const originalBox = document.getElementById("originalBox");
  const suggestionBox = document.getElementById("suggestionBox");
  const improvedBox = document.getElementById("improvedBox");

  // ✅ Generate Question
  window.generateWithCohere = async function () {
    const category = document.getElementById("category").value;
    questionDisplay.textContent = "⏳ Generating...";
    const prompt = `Generate a ${category} interview question.`;

    try {
      const response = await fetch("https://api.cohere.ai/v1/generate", {
        method: "POST",
        headers: {
          Authorization: "Bearer jIWb1Vibong8PFTmB9Uc8wn9ZWW2M60r8wgsnFDr",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "command",
          prompt,
          max_tokens: 50,
          temperature: 0.8
        })
      });
      const data = await response.json();
      questionDisplay.textContent = data.generations[0].text.trim();
    } catch (err) {
      questionDisplay.textContent = "❌ Error: " + err.message;
    }
  };

  // ✅ Submit Answer
  submitBtn?.addEventListener("click", async () => {
    const answer = answerInput.value.trim();
    const question = questionDisplay.textContent.trim();
    if (!answer || question.includes("appear here")) {
      alert("Please enter your answer and generate a question first.");
      return;
    }

    originalBox.textContent = answer;
    suggestionBox.textContent = "⏳ Getting suggestions...";
    improvedBox.textContent = "";

    const prompt = `
You are an AI interview coach.
A candidate gave this answer:

"${answer}"

Respond strictly in this format:
1. Critique: <critique>
2. Suggestions: <suggestions>
3. Improved: <improved version>`;

    try {
      const res = await fetch("https://api.cohere.ai/v1/generate", {
        method: "POST",
        headers: {
          Authorization: "Bearer jIWb1Vibong8PFTmB9Uc8wn9ZWW2M60r8wgsnFDr",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "command",
          prompt,
          max_tokens: 400,
          temperature: 0.7
        })
      });

      const data = await res.json();
      const text = data?.generations?.[0]?.text?.trim();

      const critique = (text.match(/1\.\s*Critique:\s*(.*?)(?=2\.|$)/s) || [])[1]?.trim();
      const suggestions = (text.match(/2\.\s*Suggestions:\s*(.*?)(?=3\.|$)/s) || [])[1]?.trim();
      const improved = (text.match(/3\.\s*Improved:\s*([\s\S]*)/) || [])[1]?.trim();

      suggestionBox.textContent = suggestions || "⚠️ Suggestions not found.";
      improvedBox.textContent = improved || "⚠️ Improved version not found.";

      await supabase.from("answers").insert({
        user_email: userEmail,
        question,
        answer,
        feedback: text
      });
    } catch (err) {
      suggestionBox.textContent = "❌ Error getting feedback.";
    }
  });

  // ✅ Fetch Progress History
  const status = document.getElementById("progress-status");
  const historyContainer = document.getElementById("progress-history");
  const chartCanvas = document.getElementById("feedbackChart");

  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false });

  if (error) {
    status.textContent = "❌ Failed to load progress: " + error.message;
    return;
  }

  if (!answers || answers.length === 0) {
    status.textContent = "📭 No feedback history found yet.";
    document.getElementById("total-entries").textContent = "0";
    document.getElementById("last-date").textContent = "--";
    document.getElementById("avg-daily").textContent = "--";
    return;
  }

  status.style.display = "none";

  // Stats
  const totalEntries = answers.length;
  document.getElementById("total-entries").textContent = totalEntries;

  const latestDate = new Date(answers[0].created_at);
  document.getElementById("last-date").textContent = latestDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  const firstDate = new Date(answers[answers.length - 1].created_at);
  const totalDays = Math.max(1, Math.ceil((latestDate - firstDate) / (1000 * 60 * 60 * 24)));
  const avg = (totalEntries / totalDays).toFixed(1);
  document.getElementById("avg-daily").textContent = avg;

  // Streaks
  const dateSet = new Set(answers.map(a => new Date(a.created_at).toISOString().split('T')[0]));
  const sortedDates = Array.from(dateSet).sort();
  const practiceDays = sortedDates.map(d => new Date(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let longestStreak = 0;

  for (let i = practiceDays.length - 1; i >= 0; i--) {
    const date = practiceDays[i];
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - (practiceDays.length - 1 - i));
    const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (diff === 0 || diff === 1) {
      let streak = 1;
      let j = i - 1;
      while (j >= 0 && (date - practiceDays[j]) / (1000 * 60 * 60 * 24) === 1) {
        streak++;
        date.setDate(date.getDate() - 1);
        j--;
      }
      currentStreak = streak;
      break;
    }
  }

  for (let i = 0; i < practiceDays.length; i++) {
    let count = 1;
    let prev = practiceDays[i];
    for (let j = i + 1; j < practiceDays.length; j++) {
      const diff = (practiceDays[j] - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        count++;
        prev = practiceDays[j];
      } else if (diff > 1) {
        break;
      }
    }
    longestStreak = Math.max(longestStreak, count);
  }

  document.getElementById("current-streak").textContent = currentStreak;
  document.getElementById("longest-streak").textContent = longestStreak;

  // Badges
  const badges = [
    { name: "Rookie", desc: "Completed your first feedback!", emoji: "🥉", check: () => totalEntries >= 1 },
    { name: "Getting There", desc: "Completed 5 feedback entries!", emoji: "🏅", check: () => totalEntries >= 5 },
    { name: "Consistent", desc: "Current streak of 3+ days!", emoji: "🔥", check: () => currentStreak >= 3 },
    { name: "Veteran", desc: "Completed 20 feedbacks!", emoji: "🏆", check: () => totalEntries >= 20 },
    { name: "Streak Master", desc: "Longest streak 7+ days!", emoji: "🌟", check: () => longestStreak >= 7 }
  ];

  const badgeContainer = document.getElementById("badge-list");
  badgeContainer.innerHTML = "";
  badges.forEach(badge => {
    if (badge.check()) {
      const el = document.createElement("div");
      el.className = "badge";
      el.innerHTML = `<span class="emoji">${badge.emoji}</span><div class="badge-text"><strong>${badge.name}</strong><p>${badge.desc}</p></div>`;
      badgeContainer.appendChild(el);
    }
  });

  // Accordions
  answers.forEach(item => {
    const entry = document.createElement("div");
    entry.className = "progress-entry";
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    entry.innerHTML = `
      <div class="accordion">
        <button class="accordion-header"><i class="ph ph-calendar-star"></i> ${date} ⬇</button>
        <div class="accordion-body">
          <p><strong><i class="ph ph-chat-centered-text"></i> Question:</strong> ${item.question}</p>
          <p><strong><i class="ph ph-note-pencil"></i> Your Answer:</strong> ${item.answer}</p>
          <p><strong><i class="ph ph-open-ai-logo"></i> Feedback:</strong></p>
          <pre>${item.feedback}</pre>
        </div>
      </div>`;
    historyContainer.appendChild(entry);
  });

  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const acc = header.closest(".accordion");
      const body = acc.querySelector(".accordion-body");
      const open = acc.classList.contains("open");

      document.querySelectorAll(".accordion").forEach(a => {
        a.classList.remove("open");
        a.querySelector(".accordion-body").style.maxHeight = null;
        a.querySelector(".accordion-header").innerHTML =
          a.querySelector(".accordion-header").innerHTML.replace("⬆", "⬇");
      });

      if (!open) {
        acc.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
        header.innerHTML = header.innerHTML.replace("⬇", "⬆").replace("Expand", "Minimize");
        }
    });
  });

  // Chart
  const dateCounts = {};
  answers.forEach(a => {
    const d = new Date(a.created_at).toISOString().split("T")[0];
    dateCounts[d] = (dateCounts[d] || 0) + 1;
  });

  new Chart(chartCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: Object.keys(dateCounts),
      datasets: [{
        label: "📈 Entries per Day",
        data: Object.values(dateCounts),
        backgroundColor: [
          "#a259ffcc", "#fcb1fccc", "#b5f5fccc", "#ffd6a5cc", "#d0bfffcc", "#caffbfcc"
        ],
        borderRadius: 12,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#333",
          bodyColor: "#444",
          borderColor: "#a259ff",
          borderWidth: 1,
          titleFont: { family: "Jersey 10", size: 14 },
          bodyFont: { family: "Jersey 10", size: 13 }
        }
      },
      scales: {
        x: {
          ticks: { color: "#333", font: { family: "Jersey 10", size: 12 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: "#333", font: { family: "Jersey 10", size: 12 } },
          grid: { color: "rgba(0,0,0,0.05)" }
        }
      }
    }
  });
});

// ✅ Logout
window.logout = async function () {
  const { error } = await supabase.auth.signOut();
  if (!error) window.location.href = "index.html";
  else alert("Logout failed: " + error.message);
};
