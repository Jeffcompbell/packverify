import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginModal } from './LoginModal';

interface ShowcaseItem {
  emoji: string;
  title: string;
  desc: string;
  issues: string[];
}

interface ShowcaseScene {
  [key: string]: ShowcaseItem[];
}

const SHOWCASE_DATA: ShowcaseScene = {
  food: [
    { emoji: '🥛', title: '纯牛奶包装盒', desc: '营养成分表、生产日期、配料表检测', issues: ['缺少空格', '日期格式错误', '营养值异常'] },
    { emoji: '🥣', title: '酸奶杯盖', desc: '产品名称、保质期、储存条件检测', issues: [] },
    { emoji: '🍪', title: '饼干包装袋', desc: '配料表、过敏原、净含量检测', issues: ['错别字'] },
    { emoji: '🧃', title: '果汁瓶标', desc: '营养成分、产地、条码检测', issues: ['条码模糊', '对齐偏移'] },
  ],
  pharma: [
    { emoji: '💊', title: '感冒药说明书', desc: '用法用量、禁忌症、不良反应检测', issues: [] },
    { emoji: '💉', title: '维生素瓶标', desc: '成分含量、服用方法、有效期检测', issues: ['字号过小'] },
    { emoji: '🌿', title: '中药饮片', desc: '品名、规格、用法检测', issues: [] },
    { emoji: '🩺', title: '医疗器械', desc: '注册证号、使用说明、警示语检测', issues: ['缺少警示语', '批号模糊'] },
  ],
  cosmetic: [
    { emoji: '🧴', title: '洗发水瓶标', desc: '成分表、使用方法、注意事项检测', issues: ['错别字', '文字对齐'] },
    { emoji: '🧴', title: '面霜盒', desc: '成分、功效、保质期检测', issues: [] },
    { emoji: '🦷', title: '牙膏管', desc: '含氟量、用法、警示语检测', issues: ['空格缺失'] },
    { emoji: '🌸', title: '香水盒', desc: '品名、容量、产地检测', issues: [] },
  ],
  other: [
    { emoji: '📦', title: '电子产品包装', desc: '型号、规格、认证标志检测', issues: ['认证标志模糊'] },
    { emoji: '🧸', title: '玩具包装', desc: '年龄警示、安全标准、材质检测', issues: [] },
    { emoji: '👕', title: '服装吊牌', desc: '成分、尺码、洗涤说明检测', issues: ['成分比例错误', '对齐问题'] },
    { emoji: '✏️', title: '文具包装', desc: '品牌、规格、条码检测', issues: [] },
  ],
};

const SCENE_LABELS: Record<string, string> = {
  food: '食品',
  pharma: '药品',
  cosmetic: '日化',
  other: '其他',
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeScene, setActiveScene] = useState('food');
  const [activeThumbIndex, setActiveThumbIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSceneData = SHOWCASE_DATA[activeScene];
  const currentItem = currentSceneData[activeThumbIndex];

  // Handle file selection
  const handleFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      setPendingFiles(imageFiles.slice(0, 20));
      setTimeout(() => setShowUploadModal(true), 100);
    }
  }, []);

  // Upload zone click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // File input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  // Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        handleFiles(files);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  // Close upload modal
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle login redirect - open auth modal
  const handleOpenAuth = () => {
    setShowUploadModal(false);
    setShowAuthModal(true);
  };

  // Handle successful login
  const handleLoginSuccess = async () => {
    setShowAuthModal(false);
    // Store pending files info in sessionStorage for after login
    if (pendingFiles.length > 0) {
      sessionStorage.setItem('pendingUpload', 'true');
    }
    navigate('/app');
  };

  // Smooth scroll
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-page">
      {/* Inline styles for landing page */}
      <style>{`
        .landing-page {
          --bg: #fafbfc;
          --bg-subtle: #ffffff;
          --bg-card: #f4f6f8;
          --border: rgba(0,0,0,0.08);
          --border-hover: rgba(0,0,0,0.15);
          --text: #1a1d21;
          --text-muted: #5c6370;
          --accent: #e67e22;
          --accent-hover: #d35400;
          --accent-light: rgba(230, 126, 34, 0.08);
          --success: #27ae60;
          --error: #e74c3c;

          font-family: 'DM Sans', -apple-system, sans-serif;
          background: var(--bg);
          color: var(--text);
          line-height: 1.5;
          min-height: 100vh;
        }

        .landing-page * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .serif {
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic;
        }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr;
        }

        .landing-page nav {
          grid-column: 1 / -1;
          padding: 16px 48px !important;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          background: var(--bg-subtle);
          box-sizing: border-box;
        }

        .logo {
          font-weight: 600;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--accent), #d35400);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(230, 126, 34, 0.25);
        }

        .nav-links {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .nav-links a {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.9rem;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: var(--text);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          border-radius: 10px;
          font-weight: 500;
          font-size: 0.9rem;
          text-decoration: none;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(230, 126, 34, 0.3);
        }

        .btn-primary:hover {
          background: var(--accent-hover);
          box-shadow: 0 4px 12px rgba(230, 126, 34, 0.4);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-ghost:hover {
          background: var(--bg-subtle);
          border-color: var(--border-hover);
        }

        .btn-lg {
          padding: 0.875rem 1.75rem;
          font-size: 1rem;
        }

        .left-panel {
          padding: 3rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 1px solid var(--border);
          background: var(--bg-subtle);
        }

        .hero-text {
          margin-bottom: 2.5rem;
        }

        .hero-text h1 {
          font-size: 2.75rem;
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: 1rem;
        }

        .hero-text h1 .accent {
          color: var(--accent);
        }

        .hero-text p {
          font-size: 1.1rem;
          color: var(--text-muted);
          max-width: 400px;
        }

        .upload-zone {
          background: var(--bg-card);
          border: 2px dashed rgba(0,0,0,0.12);
          border-radius: 16px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .upload-zone:hover, .upload-zone.dragover {
          border-color: var(--accent);
          background: var(--accent-light);
        }

        .upload-zone.dragover {
          background: rgba(230, 126, 34, 0.12);
          transform: scale(1.01);
        }

        .upload-zone input {
          display: none;
        }

        .upload-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, rgba(230,126,34,0.15), rgba(230,126,34,0.05));
          border: 1px solid rgba(230,126,34,0.25);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          margin: 0 auto 1.25rem;
        }

        .upload-zone h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .upload-zone p {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
        }

        .upload-hint {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .upload-hint span {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .features-mini {
          display: flex;
          gap: 1.5rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
        }

        .feature-mini {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .feature-mini-icon {
          width: 28px;
          height: 28px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
        }

        .right-panel {
          background: var(--bg-card);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .showcase-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .showcase-header h2 {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .showcase-tabs {
          display: flex;
          gap: 0.5rem;
        }

        .showcase-tab {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-muted);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .showcase-tab.active {
          background: var(--bg-subtle);
          border-color: var(--border);
          color: var(--text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .showcase-tab:hover:not(.active) {
          color: var(--text);
        }

        .showcase-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow: hidden;
        }

        .showcase-main {
          flex: 1;
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          min-height: 280px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }

        .showcase-main-img {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 5rem;
        }

        .showcase-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1.5rem;
          background: linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.9) 60%, transparent 100%);
        }

        .showcase-overlay h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .showcase-overlay p {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .showcase-issues-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .issue-tag {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          padding: 0.375rem 0.75rem;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 6px;
          color: var(--error);
        }

        .issue-tag.ok {
          background: rgba(34,197,94,0.15);
          border-color: rgba(34,197,94,0.3);
          color: var(--success);
        }

        .showcase-thumbs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
        }

        .showcase-thumb {
          aspect-ratio: 1;
          background: var(--bg-subtle);
          border: 2px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          position: relative;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }

        .showcase-thumb:hover {
          border-color: var(--border-hover);
        }

        .showcase-thumb.active {
          border-color: var(--accent);
        }

        .thumb-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 0.6rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }

        .thumb-badge.error {
          background: var(--error);
          color: white;
        }

        .thumb-badge.ok {
          background: var(--success);
          color: white;
        }

        .modal-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .modal-overlay.active {
          display: flex;
        }

        .modal {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 2.5rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          animation: modalIn 0.3s ease;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-icon {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, rgba(230,126,34,0.15), rgba(230,126,34,0.05));
          border: 1px solid rgba(230,126,34,0.25);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 1.5rem;
        }

        .modal h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .modal p {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .modal-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .upload-preview {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .preview-thumb {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid var(--border);
        }

        .preview-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-more {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: var(--bg-card);
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .section {
          padding: 5rem 3rem;
          border-top: 1px solid var(--border);
          background: var(--bg-subtle);
        }

        .section-inner {
          max-width: 1000px;
          margin: 0 auto;
        }

        .section-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .section-label {
          font-size: 0.85rem;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.75rem;
        }

        .section h2 {
          font-size: 2rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin-bottom: 0.75rem;
        }

        .section-desc {
          color: var(--text-muted);
          font-size: 1rem;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .pricing-card {
          padding: 2rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 16px;
          position: relative;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .pricing-card:hover {
          border-color: var(--border-hover);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }

        .pricing-card.featured {
          border-color: var(--accent);
          background: linear-gradient(180deg, rgba(230,126,34,0.06) 0%, var(--bg-subtle) 100%);
          box-shadow: 0 4px 20px rgba(230,126,34,0.15);
        }

        .pricing-card.featured::before {
          content: '推荐';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: #000;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 1rem;
          border-radius: 9999px;
        }

        .pricing-name {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        .pricing-price {
          font-size: 2.5rem;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .pricing-price span {
          font-size: 1rem;
          font-weight: 400;
          color: var(--text-muted);
        }

        .pricing-desc {
          color: var(--text-muted);
          font-size: 0.85rem;
          margin: 1rem 0 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1.5rem;
        }

        .pricing-features li {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .pricing-features li::before {
          content: '✓';
          color: var(--accent);
          font-weight: bold;
        }

        .pricing-card .btn {
          width: 100%;
        }

        .about-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: center;
        }

        .about-text h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .about-text p {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.7;
          margin-bottom: 1rem;
        }

        .about-features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .about-feature {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .about-feature-icon {
          width: 36px;
          height: 36px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }

        .about-visual {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          font-size: 4rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }

        footer {
          padding: 2rem 3rem;
          border-top: 1px solid var(--border);
          background: var(--bg-subtle);
        }

        .footer-inner {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-text {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .footer-links {
          display: flex;
          gap: 1.5rem;
        }

        .footer-links a {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.85rem;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: var(--text);
        }

        @media (max-width: 1024px) {
          .page {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto 1fr;
          }

          .left-panel {
            border-right: none;
            border-bottom: 1px solid var(--border);
            padding: 2rem;
          }

          .hero-text h1 {
            font-size: 2rem;
          }

          .right-panel {
            min-height: 500px;
          }

          .features-mini {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 900px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            max-width: 360px;
            margin: 0 auto;
          }

          .about-content {
            grid-template-columns: 1fr;
          }

          .about-visual {
            order: -1;
            min-height: 200px;
          }
        }

        @media (max-width: 600px) {
          nav {
            padding: 1rem;
          }

          .nav-links a:not(.btn) {
            display: none;
          }

          .left-panel {
            padding: 1.5rem;
          }

          .upload-zone {
            padding: 2rem 1.5rem;
          }

          .showcase-thumbs {
            grid-template-columns: repeat(4, 1fr);
          }

          .modal {
            padding: 2rem 1.5rem;
          }

          .about-features {
            grid-template-columns: 1fr;
          }

          .footer-inner {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
        }
      `}</style>

      <div className="page">
        {/* NAV */}
        <nav>
          <div className="logo">
            <div className="logo-icon">📦</div>
            PackVerify
          </div>
          <div className="nav-links">
            <a href="#pricing" onClick={(e) => handleSmoothScroll(e, '#pricing')}>定价</a>
            <a href="#about" onClick={(e) => handleSmoothScroll(e, '#about')}>关于</a>
            <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">登录</button>
          </div>
        </nav>

        {/* LEFT - UPLOAD */}
        <section className="left-panel">
          <div className="hero-text">
            <h1>上传包装图<br /><span className="serif accent">AI 秒检</span></h1>
            <p>检测印刷错误、排版问题、数据异常。拖拽图片即可开始。</p>
          </div>

          <div
            className="upload-zone"
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            <div className="upload-icon">📤</div>
            <h3>拖拽图片到这里</h3>
            <p>或点击选择文件 · 支持批量上传</p>
            <div className="upload-hint">
              <span>📋 支持粘贴</span>
              <span>🖼️ JPG/PNG/WebP</span>
              <span>📁 最多20张</span>
            </div>
          </div>

          <div className="features-mini">
            <div className="feature-mini">
              <div className="feature-mini-icon">🔍</div>
              <span>错别字检测</span>
            </div>
            <div className="feature-mini">
              <div className="feature-mini-icon">📐</div>
              <span>排版审核</span>
            </div>
            <div className="feature-mini">
              <div className="feature-mini-icon">📊</div>
              <span>数据校验</span>
            </div>
            <div className="feature-mini">
              <div className="feature-mini-icon">🏷️</div>
              <span>合规检测</span>
            </div>
          </div>
        </section>

        {/* RIGHT - SHOWCASE */}
        <section className="right-panel">
          <div className="showcase-header">
            <h2>检测案例</h2>
            <div className="showcase-tabs">
              {Object.keys(SHOWCASE_DATA).map((scene) => (
                <button
                  key={scene}
                  className={`showcase-tab ${activeScene === scene ? 'active' : ''}`}
                  onClick={() => { setActiveScene(scene); setActiveThumbIndex(0); }}
                >
                  {SCENE_LABELS[scene]}
                </button>
              ))}
            </div>
          </div>

          <div className="showcase-content">
            <div className="showcase-main">
              <div className="showcase-main-img">{currentItem.emoji}</div>
              <div className="showcase-overlay">
                <h3>{currentItem.title}</h3>
                <p>{currentItem.desc}</p>
                <div className="showcase-issues-list">
                  {currentItem.issues.length > 0 ? (
                    currentItem.issues.map((issue, i) => (
                      <span key={i} className="issue-tag">⚠️ {issue}</span>
                    ))
                  ) : (
                    <span className="issue-tag ok">✓ 未发现问题</span>
                  )}
                </div>
              </div>
            </div>
            <div className="showcase-thumbs">
              {currentSceneData.map((item, idx) => (
                <div
                  key={idx}
                  className={`showcase-thumb ${activeThumbIndex === idx ? 'active' : ''}`}
                  onClick={() => setActiveThumbIndex(idx)}
                >
                  {item.emoji}
                  <span className={`thumb-badge ${item.issues.length > 0 ? 'error' : 'ok'}`}>
                    {item.issues.length > 0 ? item.issues.length : '✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">定价</div>
            <h2>简单透明的价格</h2>
            <p className="section-desc">按需选择，新用户注册即送免费额度</p>
          </div>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-name">体验版</div>
              <div className="pricing-price">免费</div>
              <div className="pricing-desc">适合初次体验，了解产品能力</div>
              <ul className="pricing-features">
                <li>20次检测额度</li>
                <li>基础检测模型</li>
                <li>标准检测报告</li>
              </ul>
              <button onClick={() => setShowAuthModal(true)} className="btn btn-ghost">开始体验</button>
            </div>
            <div className="pricing-card featured">
              <div className="pricing-name">专业版</div>
              <div className="pricing-price">¥99<span>/月</span></div>
              <div className="pricing-desc">适合中小团队日常质检</div>
              <ul className="pricing-features">
                <li>500次检测/月</li>
                <li>高级检测模型</li>
                <li>自定义词库</li>
                <li>批量报告导出</li>
              </ul>
              <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">立即订阅</button>
            </div>
            <div className="pricing-card">
              <div className="pricing-name">企业版</div>
              <div className="pricing-price">定制</div>
              <div className="pricing-desc">大规模使用，定制化服务</div>
              <ul className="pricing-features">
                <li>无限检测额度</li>
                <li>API接口对接</li>
                <li>专属客户经理</li>
                <li>私有化部署</li>
              </ul>
              <a href="mailto:contact@packverify.com" className="btn btn-ghost">联系我们</a>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section" id="about">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">关于</div>
            <h2>为什么选择 PackVerify</h2>
          </div>
          <div className="about-content">
            <div className="about-text">
              <h3>AI驱动的智能质检</h3>
              <p>PackVerify 结合先进的视觉AI模型与行业规则引擎，专为包装印刷质检场景优化。无论是食品、药品还是日化产品，都能快速准确地发现潜在问题。</p>
              <p>告别传统人工审核的低效与疏漏，让AI成为您的质检助手。</p>
              <div className="about-features">
                <div className="about-feature">
                  <div className="about-feature-icon">⚡</div>
                  <span>秒级检测</span>
                </div>
                <div className="about-feature">
                  <div className="about-feature-icon">🎯</div>
                  <span>高准确率</span>
                </div>
                <div className="about-feature">
                  <div className="about-feature-icon">📊</div>
                  <span>详细报告</span>
                </div>
                <div className="about-feature">
                  <div className="about-feature-icon">🔒</div>
                  <span>数据安全</span>
                </div>
              </div>
            </div>
            <div className="about-visual">🤖</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-text">© 2024 PackVerify. All rights reserved.</div>
          <div className="footer-links">
            <a href="#">隐私政策</a>
            <a href="#">服务条款</a>
            <a href="mailto:contact@packverify.com">联系我们</a>
          </div>
        </div>
      </footer>

      {/* UPLOAD PREVIEW MODAL */}
      <div className={`modal-overlay ${showUploadModal ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && closeUploadModal()}>
        <div className="modal">
          <div className="modal-icon">🔐</div>
          <h2>登录后开始检测</h2>
          <div className="upload-preview">
            {pendingFiles.slice(0, 4).map((file, i) => (
              <div key={i} className="preview-thumb">
                <img src={URL.createObjectURL(file)} alt="" />
              </div>
            ))}
            {pendingFiles.length > 4 && (
              <div className="preview-more">+{pendingFiles.length - 4}</div>
            )}
          </div>
          <p>您已选择 <strong>{pendingFiles.length}</strong> 张图片<br />登录后即可创建产品并开始AI检测</p>
          <div className="modal-actions">
            <button onClick={handleOpenAuth} className="btn btn-primary btn-lg">立即登录</button>
            <button className="btn btn-ghost" onClick={closeUploadModal}>稍后再说</button>
          </div>
        </div>
      </div>

      {/* AUTH LOGIN MODAL */}
      <LoginModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLoginSuccess}
      />
    </div>
  );
};

export default LandingPage;
