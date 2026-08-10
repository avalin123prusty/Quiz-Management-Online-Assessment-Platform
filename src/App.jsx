import { useState } from 'react'
import './App.css'

const quizzes = [
  { title: 'JavaScript Foundations', category: 'Development', questions: 20, time: '18 min', progress: 72, color: 'coral' },
  { title: 'Product Design Principles', category: 'Design', questions: 15, time: '12 min', progress: 0, color: 'blue' },
  { title: 'Data Structures & Algorithms', category: 'Development', questions: 25, time: '24 min', progress: 34, color: 'yellow' },
]

const menuItems = ['Overview', 'Quiz library', 'My history', 'Performance', 'Leaderboard']

function App() {
  const [active, setActive] = useState('Overview')
  const [role, setRole] = useState('Student')
  const [selectedQuiz, setSelectedQuiz] = useState(null)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">Q</span><span>quizly</span></div>
        <div className="profile"><div className="avatar">AM</div><div><strong>Alex Morgan</strong><small>{role} account</small></div><button className="icon-button" aria-label="Open profile">...</button></div>
        <nav aria-label="Main navigation">
          <span className="nav-label">Workspace</span>
          {menuItems.map((label, index) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}><span className={`nav-icon icon-${index}`}></span>{label}{label === 'My history' && <span className="nav-count">3</span>}</button>)}
          {role === 'Admin' && <><span className="nav-label admin-label">Admin</span><button className="nav-item" onClick={() => setActive('Manage quizzes')}><span className="nav-icon icon-1"></span>Manage quizzes</button><button className="nav-item" onClick={() => setActive('Analytics')}><span className="nav-icon icon-3"></span>Analytics</button></>}
        </nav>
        <div className="sidebar-footer"><button className="nav-item"><span className="nav-icon icon-gear"></span>Settings</button><button className="nav-item"><span className="nav-icon icon-logout"></span>Log out</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {active}</div><div className="top-actions"><button className="role-switch" onClick={() => setRole(role === 'Student' ? 'Admin' : 'Student')}>{role}<span className="chevron">v</span></button><button className="notification" aria-label="Notifications">!<span></span></button><div className="mini-avatar">AM</div></div></header>
        {selectedQuiz ? <section className="quiz-view"><button className="back-button" onClick={() => setSelectedQuiz(null)}>^ Back to quiz library</button><div className="quiz-hero"><div><span className="eyebrow">{selectedQuiz.category}</span><h1>{selectedQuiz.title}</h1><p>Test your knowledge with {selectedQuiz.questions} carefully curated questions.</p></div><div className="quiz-meta"><strong>{selectedQuiz.time}</strong><small>estimated time</small><button className="primary-button">Start quiz <span>-&gt;</span></button></div></div><div className="question-preview"><span className="preview-number">01</span><div><span className="eyebrow">Ready when you are</span><h2>Your next challenge starts here.</h2><p>You can pause and return to this quiz anytime. Your progress is saved automatically.</p></div></div></section> : <>
          <section className="welcome"><div><span className="eyebrow">Monday, August 10, 2026</span><h1>Good morning, Alex<span className="wave">.</span></h1><p>Keep your momentum going. You are only one quiz away from your next milestone.</p></div><div className="streak"><span className="streak-flame">*</span><div><strong>7 day streak</strong><small>Best: 12 days</small></div></div></section>
          <section className="stats-grid"><div className="stat-card"><span className="stat-icon coral-bg">/</span><div><small>Quizzes completed</small><strong>24</strong><span className="delta up">+4 this month</span></div></div><div className="stat-card"><span className="stat-icon blue-bg">%</span><div><small>Average score</small><strong>86<span className="unit">%</span></strong><span className="delta up">+8% vs last month</span></div></div><div className="stat-card"><span className="stat-icon yellow-bg">*</span><div><small>Hours learned</small><strong>18.5</strong><span className="delta">This month</span></div></div><div className="stat-card"><span className="stat-icon green-bg">+</span><div><small>Current rank</small><strong>#12</strong><span className="delta up">up 5 positions</span></div></div></section>
          <section className="section-heading"><div><span className="eyebrow">Build your knowledge</span><h2>Pick up where you left off</h2></div><button className="text-button" onClick={() => setActive('Quiz library')}>View all quizzes <span>-&gt;</span></button></section>
          <section className="quiz-grid">{quizzes.map((quiz) => <article className={`quiz-card ${quiz.color}`} key={quiz.title}><div className="card-top"><span className="category">{quiz.category}</span><button className="more" aria-label={`More options for ${quiz.title}`}>...</button></div><h3>{quiz.title}</h3><div className="card-details"><span>{quiz.questions} questions</span><span>{quiz.time}</span></div>{quiz.progress > 0 && <div className="progress-wrap"><div className="progress-label"><span>Progress</span><strong>{quiz.progress}%</strong></div><div className="progress"><span style={{ width: `${quiz.progress}%` }}></span></div></div>}<button className="card-button" onClick={() => setSelectedQuiz(quiz)}>{quiz.progress > 0 ? 'Continue quiz' : 'Start quiz'} <span>-&gt;</span></button></article>)}</section>
          <section className="lower-grid"><div className="activity-panel"><div className="panel-heading"><div><span className="eyebrow">Your activity</span><h2>Learning overview</h2></div><select aria-label="Activity period"><option>Last 30 days</option><option>Last 90 days</option></select></div><div className="chart-area"><div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="chart-lines"><i></i><i></i><i></i><i></i><i></i><div className="bars">{[38, 52, 44, 66, 52, 72, 86, 61, 70, 82, 68, 92].map((height, index) => <span key={index} style={{ height: `${height}%` }}></span>)}</div><div className="chart-x"><span>May 12</span><span>May 19</span><span>May 26</span><span>Jun 02</span></div></div></div></div><div className="ranking-panel"><div className="panel-heading"><div><span className="eyebrow">Keep climbing</span><h2>Leaderboard</h2></div><button className="dots-button">...</button></div><div className="rank-row"><span className="rank-number">01</span><div className="rank-avatar purple">JS</div><div><strong>Jordan Smith</strong><small>2,840 points</small></div><span className="rank-change">+2</span></div><div className="rank-row"><span className="rank-number">02</span><div className="rank-avatar orange">TK</div><div><strong>Taylor Kim</strong><small>2,710 points</small></div><span className="rank-change">+1</span></div><div className="rank-row current"><span className="rank-number">12</span><div className="rank-avatar">AM</div><div><strong>Alex Morgan</strong><small>1,960 points</small></div><span className="rank-change">+5</span></div><button className="leaderboard-button" onClick={() => setActive('Leaderboard')}>View leaderboard <span>-&gt;</span></button></div></section>
        </>}
      </main>
    </div>
  )
}

export default App
