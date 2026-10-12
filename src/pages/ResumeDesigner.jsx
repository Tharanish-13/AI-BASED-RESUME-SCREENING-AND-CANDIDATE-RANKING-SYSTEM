import React, { useState, useEffect, useRef } from 'react';
import { templateService } from '../services/api';
import { 
  Palette, 
  Download, 
  Eye, 
  Loader2, 
  X as XIcon, 
  Check, 
  Sparkles, 
  RefreshCw, 
  User, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  FolderGit2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Plus,
  Trash2,
  Award,
  Languages,
  Layers
} from 'lucide-react';
import Modal from 'react-modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '../components/ui/Toaster';

Modal.setAppElement('#root');

// --- Curated Resume.io-inspired Color Themes ---
const COLOR_THEMES = [
  { id: 'slate', name: 'Slate Dark', primary: '#1e293b', accent: '#3b82f6', bgLight: '#f8fafc' },
  { id: 'teal', name: 'Teal Emerald', primary: '#0f766e', accent: '#14b8a6', bgLight: '#f0fdf4' },
  { id: 'indigo', name: 'Royal Indigo', primary: '#4f46e5', accent: '#6366f1', bgLight: '#eef2ff' },
  { id: 'blue', name: 'Ocean Blue', primary: '#1d4ed8', accent: '#3b82f6', bgLight: '#eff6ff' },
  { id: 'crimson', name: 'Crimson Red', primary: '#991b1b', accent: '#ef4444', bgLight: '#fef2f2' },
  { id: 'onyx', name: 'Onyx Black', primary: '#09090b', accent: '#71717a', bgLight: '#fafafa' },
  { id: 'amber', name: 'Amber Gold', primary: '#b45309', accent: '#f59e0b', bgLight: '#fffbeb' }
];

// --- Default Templates inspired by Resume.io ---
const FALLBACK_TEMPLATES = [
  {
    id: 'stockholm-modern',
    name: 'Stockholm',
    description: 'Dual-column layout with dark left sidebar, skill tags, and crisp typography',
    category: 'Modern',
    layout: 'sidebar-left',
    defaultColor: '#1e293b',
    preview: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'harvard-professional',
    name: 'Harvard',
    description: 'Executive top banner with clean horizontal rules, ideal for corporate roles',
    category: 'Professional',
    layout: 'header-banner',
    defaultColor: '#0f766e',
    preview: 'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'vibrant-creative',
    name: 'Vibrant',
    description: 'Stylish headers and rounded skill badge chips for tech & design roles',
    category: 'Creative',
    layout: 'creative-vibrant',
    defaultColor: '#4f46e5',
    preview: 'https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'dublin-minimalist',
    name: 'Dublin',
    description: 'Ultra-clean single-column layout with subtle dividers and spacious typography',
    category: 'Minimalist',
    layout: 'minimalist-single',
    defaultColor: '#2563eb',
    preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'onyx-executive',
    name: 'Onyx',
    description: 'Premium dark accent header banner with a two-column experience & skills matrix',
    category: 'Executive',
    layout: 'onyx-executive',
    defaultColor: '#09090b',
    preview: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'sydney-compact',
    name: 'Sydney',
    description: 'High-density balanced 2-column layout optimized for technical experience',
    category: 'Compact',
    layout: 'sydney-compact',
    defaultColor: '#d97706',
    preview: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80'
  }
];

// --- Sample Resume Data with Custom Sections & Social Links ---
const SAMPLE_RESUME_DATA = {
  personalInfo: {
    fullName: 'Alex Morgan',
    jobTitle: 'Senior Full-Stack Engineer',
    email: 'alex.morgan@example.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexmorgan',
    website: 'alexmorgan.dev',
    summary: 'Innovative and results-driven Senior Full-Stack Engineer with 6+ years of experience designing scalable web applications, microservices, and AI-driven interfaces. Proven track record of leading high-performance engineering teams and accelerating product delivery.'
  },
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'TechCorp Solutions',
      duration: '2022 - Present',
      description: '• Architected resilient microservices handling over 2M daily API requests with 99.99% uptime.\n• Spearheaded AI integration features that boosted customer user retention by 28%.\n• Mentored 5 junior developers and established CI/CD automated testing standards.'
    },
    {
      title: 'Full-Stack Developer',
      company: 'Innovate Labs',
      duration: '2019 - 2022',
      description: '• Developed dynamic React & Node.js dashboards utilized by enterprise clients worldwide.\n• Optimized PostgreSQL query performance, reducing database latency by 40%.\n• Collaborated closely with UI/UX designers to implement modern design systems.'
    }
  ],
  education: [
    {
      degree: 'B.S. in Computer Science',
      school: 'University of California, Berkeley',
      year: '2019',
      gpa: '3.8 / 4.0'
    }
  ],
  skills: ['JavaScript (ES6+)', 'TypeScript', 'React.js', 'Node.js', 'Python', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS', 'Tailwind CSS', 'GraphQL'],
  projects: [
    {
      name: 'AI Document Intelligence Engine',
      description: 'Built a real-time document parsing engine using S-BERT embeddings and LLMs to extract insights from technical resumes.',
      technologies: 'React, FastAPI, Python, MongoDB'
    }
  ],
  customSections: [
    {
      id: 'cert-1',
      title: 'Certifications & Honors',
      items: [
        { title: 'AWS Certified Solutions Architect – Associate', subtitle: 'Amazon Web Services', date: '2023', description: 'Cloud Architecture & Infrastructure' },
        { title: 'Certified Scrum Master (CSM)', subtitle: 'Scrum Alliance', date: '2022', description: 'Agile & Team Leadership' }
      ]
    },
    {
      id: 'lang-1',
      title: 'Languages',
      items: [
        { title: 'English', subtitle: 'Native / Bilingual', date: '', description: '' },
        { title: 'Spanish', subtitle: 'Professional Working Proficiency', date: '', description: '' }
      ]
    }
  ]
};

// --- Reusable Input Styling ---
const inputStyles = "block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors";
const textareaStyles = "block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors";

// --- Dynamic Resume Layout Renderer ---
const ResumeDocument = ({ data, template, theme, isCompact = false }) => {
  const { personalInfo, experience, education, skills, projects, customSections } = data;
  const layout = template?.layout || 'sidebar-left';
  const primaryColor = theme?.primary || '#1e293b';

  // Helper for rendering custom section items
  const renderCustomSection = (section, isDarkBg = false) => {
    if (!section || !section.items || section.items.length === 0) return null;
    return (
      <div key={section.id || section.title} className="mb-4">
        <h2 className={`uppercase font-bold tracking-wider mb-2 text-[10px] border-b pb-1 ${isDarkBg ? 'border-white/20 text-white' : ''}`} style={!isDarkBg ? { color: primaryColor, borderColor: `${primaryColor}30` } : {}}>
          {section.title}
        </h2>
        <div className="space-y-2">
          {section.items.filter(item => item.title).map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-baseline">
                <span className={`font-bold ${isDarkBg ? 'text-white text-[11px]' : 'text-gray-900 text-xs'}`}>{item.title}</span>
                {item.date && <span className={`${isDarkBg ? 'text-white/70' : 'text-gray-500'} text-[9px]`}>{item.date}</span>}
              </div>
              {item.subtitle && <p className={`${isDarkBg ? 'text-white/80' : 'text-gray-700'} text-[10px] font-medium`}>{item.subtitle}</p>}
              {item.description && <p className={`${isDarkBg ? 'text-white/70' : 'text-gray-600'} text-[9px] mt-0.5`}>{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Component rendering for STOCKHOLM (Sidebar Left)
  if (layout === 'sidebar-left') {
    return (
      <div className={`w-full bg-white text-gray-800 shadow-sm font-sans flex flex-col md:flex-row min-h-full ${isCompact ? 'text-[9px] leading-tight' : 'text-xs leading-relaxed'}`}>
        {/* Left Sidebar */}
        <div className="w-full md:w-1/3 p-5 text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
          <h1 className={`${isCompact ? 'text-sm font-bold' : 'text-xl font-bold'} tracking-tight mb-1`}>
            {personalInfo.fullName || 'Your Name'}
          </h1>
          <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} opacity-90 font-medium mb-4`}>
            {personalInfo.jobTitle || 'Job Title'}
          </p>

          <div className="space-y-2 mb-6 opacity-90 border-t border-white/20 pt-3">
            {personalInfo.email && (
              <div className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{personalInfo.email}</span>
              </div>
            )}
            {personalInfo.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{personalInfo.phone}</span>
              </div>
            )}
            {personalInfo.location && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{personalInfo.location}</span>
              </div>
            )}
            {personalInfo.linkedin && (
              <div className="flex items-center space-x-2">
                <Linkedin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{personalInfo.linkedin}</span>
              </div>
            )}
            {personalInfo.website && (
              <div className="flex items-center space-x-2">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{personalInfo.website}</span>
              </div>
            )}
          </div>

          {skills && skills.length > 0 && (
            <div className="mb-6">
              <h2 className="uppercase tracking-wider font-semibold text-[10px] border-b border-white/20 pb-1 mb-2">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-white/15 backdrop-blur-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {education && education.length > 0 && (
            <div className="mb-6">
              <h2 className="uppercase tracking-wider font-semibold text-[10px] border-b border-white/20 pb-1 mb-2">Education</h2>
              {education.map((edu, i) => (
                <div key={i} className="mb-2">
                  <p className="font-bold text-[11px]">{edu.degree}</p>
                  <p className="opacity-80 text-[10px]">{edu.school}</p>
                  <p className="opacity-70 text-[9px]">{edu.year} {edu.gpa && `| GPA: ${edu.gpa}`}</p>
                </div>
              ))}
            </div>
          )}

          {/* Custom Sections in Sidebar */}
          {customSections && customSections.map(sec => renderCustomSection(sec, true))}
        </div>

        {/* Right Main Content */}
        <div className="w-full md:w-2/3 p-6 bg-white">
          {personalInfo.summary && (
            <div className="mb-5">
              <h2 className="uppercase font-bold text-[11px] tracking-wider mb-1.5" style={{ color: primaryColor }}>Professional Summary</h2>
              <p className="text-gray-600">{personalInfo.summary}</p>
            </div>
          )}

          {experience && experience.some(e => e.title || e.company) && (
            <div className="mb-5">
              <h2 className="uppercase font-bold text-[11px] tracking-wider mb-2 pb-1 border-b" style={{ color: primaryColor, borderColor: `${primaryColor}30` }}>
                Work Experience
              </h2>
              <div className="space-y-3">
                {experience.filter(e => e.title || e.company).map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-bold text-gray-900">{exp.title}</span>
                      <span className="text-gray-500 font-medium text-[10px]">{exp.duration}</span>
                    </div>
                    <p className="font-semibold text-gray-700 mb-1">{exp.company}</p>
                    <p className="text-gray-600 whitespace-pre-line">{exp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {projects && projects.some(p => p.name) && (
            <div>
              <h2 className="uppercase font-bold text-[11px] tracking-wider mb-2 pb-1 border-b" style={{ color: primaryColor, borderColor: `${primaryColor}30` }}>
                Key Projects
              </h2>
              <div className="space-y-2.5">
                {projects.filter(p => p.name).map((proj, i) => (
                  <div key={i}>
                    <span className="font-bold text-gray-900">{proj.name}</span>
                    <p className="text-gray-600 mt-0.5">{proj.description}</p>
                    {proj.technologies && (
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">Technologies: {proj.technologies}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Component rendering for HARVARD (Executive Top Banner)
  if (layout === 'header-banner') {
    return (
      <div className={`w-full bg-white text-gray-800 shadow-sm font-sans ${isCompact ? 'text-[9px] leading-tight' : 'text-xs leading-relaxed'}`}>
        {/* Top Banner */}
        <div className="p-6 text-white text-center" style={{ backgroundColor: primaryColor }}>
          <h1 className={`${isCompact ? 'text-base' : 'text-2xl'} font-extrabold tracking-wide uppercase`}>
            {personalInfo.fullName || 'Your Name'}
          </h1>
          <p className="text-sm opacity-90 mt-0.5 font-medium tracking-wide">
            {personalInfo.jobTitle || 'Job Title'}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-3 mt-3 text-[10px] opacity-85">
            {personalInfo.email && <span>{personalInfo.email}</span>}
            {personalInfo.phone && <span>• {personalInfo.phone}</span>}
            {personalInfo.location && <span>• {personalInfo.location}</span>}
            {personalInfo.linkedin && <span>• {personalInfo.linkedin}</span>}
            {personalInfo.website && <span>• {personalInfo.website}</span>}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {personalInfo.summary && (
            <section>
              <h2 className="font-bold text-xs uppercase tracking-wider pb-1 border-b-2 mb-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                Executive Summary
              </h2>
              <p className="text-gray-600">{personalInfo.summary}</p>
            </section>
          )}

          {experience && experience.some(e => e.title || e.company) && (
            <section>
              <h2 className="font-bold text-xs uppercase tracking-wider pb-1 border-b-2 mb-3" style={{ color: primaryColor, borderColor: primaryColor }}>
                Professional Experience
              </h2>
              <div className="space-y-3">
                {experience.filter(e => e.title || e.company).map((exp, i) => (
                  <div key={i} className="pl-3 border-l-2" style={{ borderColor: `${primaryColor}40` }}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-bold text-gray-900">{exp.title}</h3>
                      <span className="text-gray-500 text-[10px] font-medium">{exp.duration}</span>
                    </div>
                    <p className="font-semibold text-gray-700 mb-1">{exp.company}</p>
                    <p className="text-gray-600 whitespace-pre-line">{exp.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {education && education.length > 0 && (
              <section>
                <h2 className="font-bold text-xs uppercase tracking-wider pb-1 border-b-2 mb-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                  Education
                </h2>
                {education.map((edu, i) => (
                  <div key={i} className="mb-2">
                    <p className="font-bold text-gray-900">{edu.degree}</p>
                    <p className="text-gray-700">{edu.school}</p>
                    <p className="text-gray-500 text-[10px]">{edu.year} {edu.gpa && `| GPA: ${edu.gpa}`}</p>
                  </div>
                ))}
              </section>
            )}

            {skills && skills.length > 0 && (
              <section>
                <h2 className="font-bold text-xs uppercase tracking-wider pb-1 border-b-2 mb-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                  Core Competencies
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-medium text-[10px] border border-gray-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {projects && projects.some(p => p.name) && (
            <section>
              <h2 className="font-bold text-xs uppercase tracking-wider pb-1 border-b-2 mb-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                Key Projects
              </h2>
              <div className="space-y-2">
                {projects.filter(p => p.name).map((proj, i) => (
                  <div key={i}>
                    <p className="font-bold text-gray-900">{proj.name}</p>
                    <p className="text-gray-600">{proj.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Custom Sections */}
          {customSections && customSections.map(sec => renderCustomSection(sec, false))}
        </div>
      </div>
    );
  }

  // Component rendering for VIBRANT (Creative)
  if (layout === 'creative-vibrant') {
    return (
      <div className={`w-full bg-white text-gray-800 shadow-sm font-sans ${isCompact ? 'text-[9px] leading-tight' : 'text-xs leading-relaxed'}`}>
        {/* Creative Top Accent */}
        <div className="p-6 border-b-4" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className={`${isCompact ? 'text-lg' : 'text-2xl'} font-black text-gray-900`}>
                {personalInfo.fullName || 'Your Name'}
              </h1>
              <p className="text-sm font-bold mt-0.5" style={{ color: primaryColor }}>
                {personalInfo.jobTitle || 'Creative Professional'}
              </p>
            </div>
            <div className="text-right text-[10px] text-gray-600 space-y-0.5">
              {personalInfo.email && <p>{personalInfo.email}</p>}
              {personalInfo.phone && <p>{personalInfo.phone}</p>}
              {personalInfo.location && <p>{personalInfo.location}</p>}
              {personalInfo.linkedin && <p>{personalInfo.linkedin}</p>}
              {personalInfo.website && <p>{personalInfo.website}</p>}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {personalInfo.summary && (
            <section>
              <h2 className="font-extrabold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: primaryColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                About Me
              </h2>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">{personalInfo.summary}</p>
            </section>
          )}

          {skills && skills.length > 0 && (
            <section>
              <h2 className="font-extrabold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: primaryColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                Skills & Abilities
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-white font-medium text-[10px] shadow-xs" style={{ backgroundColor: primaryColor }}>
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {experience && experience.some(e => e.title || e.company) && (
            <section>
              <h2 className="font-extrabold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: primaryColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                Experience
              </h2>
              <div className="space-y-3">
                {experience.filter(e => e.title || e.company).map((exp, i) => (
                  <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-bold text-gray-900">{exp.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        {exp.duration}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-600 text-[11px] mb-1">{exp.company}</p>
                    <p className="text-gray-600 whitespace-pre-line">{exp.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Custom Sections */}
          {customSections && customSections.map(sec => (
            <section key={sec.id || sec.title}>
              <h2 className="font-extrabold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: primaryColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                {sec.title}
              </h2>
              <div className="space-y-2">
                {sec.items.filter(item => item.title).map((item, idx) => (
                  <div key={idx} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-900">{item.title}</span>
                      {item.date && <span className="text-[9px] font-semibold text-gray-500">{item.date}</span>}
                    </div>
                    {item.subtitle && <p className="text-[10px] text-gray-600 font-medium">{item.subtitle}</p>}
                    {item.description && <p className="text-[9px] text-gray-500 mt-0.5">{item.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Component rendering for DUBLIN (Minimalist) & Fallbacks
  return (
    <div className={`w-full bg-white text-gray-800 shadow-sm font-sans p-6 ${isCompact ? 'text-[9px] leading-tight' : 'text-xs leading-relaxed'}`}>
      <div className="border-b-2 pb-3 mb-4" style={{ borderColor: primaryColor }}>
        <h1 className="text-2xl font-bold text-gray-900">{personalInfo.fullName || 'Your Name'}</h1>
        <p className="text-sm font-semibold mt-0.5" style={{ color: primaryColor }}>{personalInfo.jobTitle || 'Professional'}</p>
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mt-2">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>• {personalInfo.phone}</span>}
          {personalInfo.location && <span>• {personalInfo.location}</span>}
          {personalInfo.linkedin && <span>• {personalInfo.linkedin}</span>}
          {personalInfo.website && <span>• {personalInfo.website}</span>}
        </div>
      </div>

      {personalInfo.summary && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase mb-1" style={{ color: primaryColor }}>Summary</h2>
          <p className="text-gray-600">{personalInfo.summary}</p>
        </div>
      )}

      {experience && experience.some(e => e.title || e.company) && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase mb-2 border-b pb-1" style={{ color: primaryColor }}>Experience</h2>
          <div className="space-y-2.5">
            {experience.filter(e => e.title || e.company).map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span className="font-bold">{exp.title}</span>
                  <span className="text-gray-500 text-[10px]">{exp.duration}</span>
                </div>
                <p className="text-gray-700 font-medium">{exp.company}</p>
                <p className="text-gray-600 whitespace-pre-line mt-0.5">{exp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {skills && skills.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase mb-1" style={{ color: primaryColor }}>Skills</h2>
          <p className="text-gray-700">{skills.join(', ')}</p>
        </div>
      )}

      {/* Custom Sections */}
      {customSections && customSections.map(sec => renderCustomSection(sec, false))}
    </div>
  );
};


const ResumeDesigner = () => {
  const [templates, setTemplates] = useState(FALLBACK_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState(FALLBACK_TEMPLATES[0]);
  const [selectedTheme, setSelectedTheme] = useState(COLOR_THEMES[0]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [resumeData, setResumeData] = useState(SAMPLE_RESUME_DATA);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const previewRef = useRef();
  const modalPreviewRef = useRef();
  const { toast } = useToast();

  // Load templates from API or fallback
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const data = await templateService.getTemplates();
        if (data && Array.isArray(data.templates) && data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplate(data.templates[0]);
        }
      } catch (error) {
        console.warn('Using fallback templates due to network/API error:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // Filter templates by category
  const categories = ['All', 'Modern', 'Professional', 'Creative', 'Minimalist', 'Executive', 'Compact'];
  const filteredTemplates = activeCategory === 'All' 
    ? templates 
    : templates.filter(t => t.category?.toLowerCase() === activeCategory.toLowerCase());

  // Input change handler
  const handleInputChange = (section, field, value, index = null) => {
    setResumeData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (index !== null && newData[section]?.[index] !== undefined) {
        newData[section][index][field] = value;
      } else if (section === 'skills') {
        newData.skills = value.split(',').map(s => s.trim()).filter(Boolean);
      } else if (newData[section]) {
        newData[section][field] = value;
      }
      return newData;
    });
  };

  // Add standard section item
  const addSectionItem = (section) => {
    setResumeData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      let newItem = {};
      if (section === 'experience') newItem = { title: '', company: '', duration: '', description: '' };
      if (section === 'education') newItem = { degree: '', school: '', year: '', gpa: '' };
      if (section === 'projects') newItem = { name: '', description: '', technologies: '' };
      if (newData[section]) newData[section].push(newItem);
      return newData;
    });
  };

  // Remove standard section item
  const removeSectionItem = (section, index) => {
    setResumeData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (newData[section] && newData[section].length > 1) {
        newData[section].splice(index, 1);
      } else {
        toast({ title: "At least one entry required", variant: "warning" });
      }
      return newData;
    });
  };

  // --- Custom Section Handlers ---
  const addCustomSection = (presetTitle = 'Custom Section') => {
    setResumeData(prev => {
      const newSec = {
        id: `sec-${Date.now()}`,
        title: presetTitle,
        items: [{ title: '', subtitle: '', date: '', description: '' }]
      };
      return {
        ...prev,
        customSections: [...(prev.customSections || []), newSec]
      };
    });
    toast({ title: `Added "${presetTitle}" Section` });
  };

  const removeCustomSection = (secId) => {
    setResumeData(prev => ({
      ...prev,
      customSections: (prev.customSections || []).filter(s => s.id !== secId)
    }));
  };

  const updateCustomSectionTitle = (secId, title) => {
    setResumeData(prev => {
      const updated = (prev.customSections || []).map(s => s.id === secId ? { ...s, title } : s);
      return { ...prev, customSections: updated };
    });
  };

  const addCustomItem = (secId) => {
    setResumeData(prev => {
      const updated = (prev.customSections || []).map(s => {
        if (s.id === secId) {
          return { ...s, items: [...s.items, { title: '', subtitle: '', date: '', description: '' }] };
        }
        return s;
      });
      return { ...prev, customSections: updated };
    });
  };

  const removeCustomItem = (secId, itemIdx) => {
    setResumeData(prev => {
      const updated = (prev.customSections || []).map(s => {
        if (s.id === secId) {
          const newItems = s.items.filter((_, i) => i !== itemIdx);
          return { ...s, items: newItems };
        }
        return s;
      });
      return { ...prev, customSections: updated };
    });
  };

  const updateCustomItemField = (secId, itemIdx, field, value) => {
    setResumeData(prev => {
      const updated = (prev.customSections || []).map(s => {
        if (s.id === secId) {
          const newItems = s.items.map((item, i) => i === itemIdx ? { ...item, [field]: value } : item);
          return { ...s, items: newItems };
        }
        return s;
      });
      return { ...prev, customSections: updated };
    });
  };

  // Fill sample data
  const handleFillSampleData = () => {
    setResumeData(SAMPLE_RESUME_DATA);
    toast({ title: "Sample Data Loaded", description: "Preview loaded with sample content." });
  };

  // Clear all data
  const handleClearData = () => {
    setResumeData({
      personalInfo: { fullName: '', jobTitle: '', email: '', phone: '', location: '', linkedin: '', website: '', summary: '' },
      experience: [{ title: '', company: '', duration: '', description: '' }],
      education: [{ degree: '', school: '', year: '', gpa: '' }],
      skills: [],
      projects: [{ name: '', description: '', technologies: '' }],
      customSections: []
    });
    toast({ title: "Form Cleared", description: "All fields have been reset." });
  };

  // PDF Export
  const handleDownloadPDF = async () => {
    setShowPreviewModal(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const elementToCapture = modalPreviewRef.current;
    if (!elementToCapture) {
      toast({ title: "Error", description: "Preview element not found.", variant: "destructive" });
      setShowPreviewModal(false);
      return;
    }

    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait.", duration: 3000 });

    try {
      const canvas = await html2canvas(elementToCapture, {
        scale: 3,
        useCORS: true,
        logging: false,
        windowWidth: elementToCapture.scrollWidth,
        windowHeight: elementToCapture.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.height / imgProps.width;

      const margin = 20;
      let imgWidth = pdfWidth - (margin * 2);
      let imgHeight = imgWidth * ratio;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft > 0) {
        position = position - (pdfHeight - (margin * 2));
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      const safeName = (resumeData.personalInfo.fullName || 'Resume').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${safeName}_${selectedTemplate?.name || 'template'}.pdf`;
      pdf.save(fileName);

      toast({ title: "Download Completed", description: `Saved as ${fileName}` });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({ title: "PDF Failed", description: "Could not create PDF file.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
      setShowPreviewModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>Resume Builder & Designer</span>
              <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                Resume.io Inspired
              </span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">Select professional templates, add custom sections, customize colors, and build your resume in minutes.</p>
          </div>
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            <button
              onClick={handleFillSampleData}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 flex items-center space-x-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Sample Data</span>
            </button>
            <button
              onClick={handleClearData}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 flex items-center space-x-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Column 1: Template Selection (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center justify-between">
                <span>Select Template</span>
                <span className="text-xs text-gray-400 font-normal">{filteredTemplates.length} templates</span>
              </h2>

              {/* Categories */}
              <div className="flex gap-1 overflow-x-auto pb-2 mb-3 no-scrollbar text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors font-medium ${
                      activeCategory === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template Cards */}
              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                {filteredTemplates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`cursor-pointer rounded-lg overflow-hidden border transition-all duration-200 ${
                        isSelected
                          ? 'ring-2 ring-blue-600 border-blue-600 shadow-md bg-blue-50/20'
                          : 'border-gray-200 hover:border-blue-400 hover:shadow-sm bg-white'
                      }`}
                    >
                      <div className="relative h-28 bg-gray-100 overflow-hidden">
                        <img
                          src={tpl.preview}
                          alt={tpl.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&auto=format&fit=crop&q=80'; }}
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full shadow-md">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded">
                          {tpl.category}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h3 className="font-semibold text-gray-900 text-xs">{tpl.name}</h3>
                        <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{tpl.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color Palette Selector */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>Accent Color Theme</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                      selectedTheme.id === theme.id ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: theme.primary }}
                    title={theme.name}
                  >
                    {selectedTheme.id === theme.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Resume Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Resume Details</h2>

              {/* Personal Info */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text" placeholder="Full Name *"
                    value={resumeData.personalInfo.fullName}
                    onChange={(e) => handleInputChange('personalInfo', 'fullName', e.target.value)}
                    className={inputStyles}
                  />
                  <input
                    type="text" placeholder="Target Job Title *"
                    value={resumeData.personalInfo.jobTitle}
                    onChange={(e) => handleInputChange('personalInfo', 'jobTitle', e.target.value)}
                    className={inputStyles}
                  />
                  <input
                    type="email" placeholder="Email Address *"
                    value={resumeData.personalInfo.email}
                    onChange={(e) => handleInputChange('personalInfo', 'email', e.target.value)}
                    className={inputStyles}
                  />
                  <input
                    type="tel" placeholder="Phone Number"
                    value={resumeData.personalInfo.phone}
                    onChange={(e) => handleInputChange('personalInfo', 'phone', e.target.value)}
                    className={inputStyles}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text" placeholder="Location (e.g. San Francisco, CA)"
                    value={resumeData.personalInfo.location}
                    onChange={(e) => handleInputChange('personalInfo', 'location', e.target.value)}
                    className={inputStyles}
                  />
                  <input
                    type="text" placeholder="LinkedIn URL (e.g. linkedin.com/in/user)"
                    value={resumeData.personalInfo.linkedin || ''}
                    onChange={(e) => handleInputChange('personalInfo', 'linkedin', e.target.value)}
                    className={inputStyles}
                  />
                </div>
                <input
                  type="text" placeholder="Portfolio / Website URL (e.g. alexmorgan.dev)"
                  value={resumeData.personalInfo.website || ''}
                  onChange={(e) => handleInputChange('personalInfo', 'website', e.target.value)}
                  className={inputStyles}
                />
                <textarea
                  placeholder="Professional Summary / Bio"
                  value={resumeData.personalInfo.summary}
                  onChange={(e) => handleInputChange('personalInfo', 'summary', e.target.value)}
                  rows={3} className={textareaStyles}
                />
              </section>

              {/* Experience */}
              <section className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" /> Work Experience
                  </h3>
                  <button onClick={() => addSectionItem('experience')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    + Add Experience
                  </button>
                </div>
                {resumeData.experience.map((exp, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="Job Title"
                        value={exp.title}
                        onChange={(e) => handleInputChange('experience', 'title', e.target.value, index)}
                        className={inputStyles}
                      />
                      <input
                        type="text" placeholder="Company / Organization"
                        value={exp.company}
                        onChange={(e) => handleInputChange('experience', 'company', e.target.value, index)}
                        className={inputStyles}
                      />
                    </div>
                    <input
                      type="text" placeholder="Duration (e.g. 2021 - Present)"
                      value={exp.duration}
                      onChange={(e) => handleInputChange('experience', 'duration', e.target.value, index)}
                      className={inputStyles}
                    />
                    <textarea
                      placeholder="Key responsibilities and bullet point achievements..."
                      value={exp.description}
                      onChange={(e) => handleInputChange('experience', 'description', e.target.value, index)}
                      rows={3} className={textareaStyles}
                    />
                    {resumeData.experience.length > 1 && (
                      <button onClick={() => removeSectionItem('experience', index)} className="text-xs text-red-600 hover:underline">
                        Remove Entry
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {/* Education */}
              <section className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" /> Education
                  </h3>
                  <button onClick={() => addSectionItem('education')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    + Add Education
                  </button>
                </div>
                {resumeData.education.map((edu, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="Degree / Field of Study"
                        value={edu.degree}
                        onChange={(e) => handleInputChange('education', 'degree', e.target.value, index)}
                        className={inputStyles}
                      />
                      <input
                        type="text" placeholder="University / School"
                        value={edu.school}
                        onChange={(e) => handleInputChange('education', 'school', e.target.value, index)}
                        className={inputStyles}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="Year (e.g. 2020)"
                        value={edu.year}
                        onChange={(e) => handleInputChange('education', 'year', e.target.value, index)}
                        className={inputStyles}
                      />
                      <input
                        type="text" placeholder="GPA (Optional)"
                        value={edu.gpa}
                        onChange={(e) => handleInputChange('education', 'gpa', e.target.value, index)}
                        className={inputStyles}
                      />
                    </div>
                    {resumeData.education.length > 1 && (
                      <button onClick={() => removeSectionItem('education', index)} className="text-xs text-red-600 hover:underline">
                        Remove Entry
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {/* Skills */}
              <section className="space-y-2 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4" /> Skills (Comma Separated)
                </h3>
                <input
                  type="text"
                  placeholder="e.g. React, Node.js, Python, Leadership, SQL"
                  value={resumeData.skills.join(', ')}
                  onChange={(e) => handleInputChange('skills', null, e.target.value)}
                  className={inputStyles}
                />
              </section>

              {/* Projects */}
              <section className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <FolderGit2 className="w-4 h-4" /> Key Projects
                  </h3>
                  <button onClick={() => addSectionItem('projects')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    + Add Project
                  </button>
                </div>
                {resumeData.projects.map((proj, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                    <input
                      type="text" placeholder="Project Name"
                      value={proj.name}
                      onChange={(e) => handleInputChange('projects', 'name', e.target.value, index)}
                      className={inputStyles}
                    />
                    <textarea
                      placeholder="Project description & highlights..."
                      value={proj.description}
                      onChange={(e) => handleInputChange('projects', 'description', e.target.value, index)}
                      rows={2} className={textareaStyles}
                    />
                    <input
                      type="text" placeholder="Technologies Used (e.g. React, FastAPI)"
                      value={proj.technologies}
                      onChange={(e) => handleInputChange('projects', 'technologies', e.target.value, index)}
                      className={inputStyles}
                    />
                    {resumeData.projects.length > 1 && (
                      <button onClick={() => removeSectionItem('projects', index)} className="text-xs text-red-600 hover:underline">
                        Remove Entry
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {/* DYNAMIC CUSTOM SECTIONS & FIELDS */}
              <section className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Custom Sections & Extra Fields
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => addCustomSection('Custom Section')}
                      className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded hover:bg-purple-100 transition-colors flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Custom Section</span>
                    </button>
                    <button
                      onClick={() => addCustomSection('Certifications & Honors')}
                      className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded hover:bg-amber-100 transition-colors flex items-center space-x-1"
                    >
                      <Award className="w-3 h-3" />
                      <span>+ Certifications</span>
                    </button>
                    <button
                      onClick={() => addCustomSection('Languages')}
                      className="px-2 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded hover:bg-teal-100 transition-colors flex items-center space-x-1"
                    >
                      <Languages className="w-3 h-3" />
                      <span>+ Languages</span>
                    </button>
                  </div>
                </div>

                {(resumeData.customSections || []).map((sec) => (
                  <div key={sec.id} className="p-4 bg-purple-50/40 rounded-xl border border-purple-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={sec.title}
                        onChange={(e) => updateCustomSectionTitle(sec.id, e.target.value)}
                        placeholder="Section Title (e.g. Certifications, Languages, Publications)"
                        className="font-bold text-sm text-purple-900 bg-white border border-purple-300 rounded px-2.5 py-1 focus:ring-2 focus:ring-purple-500 w-full"
                      />
                      <button
                        onClick={() => removeCustomSection(sec.id)}
                        className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50"
                        title="Delete entire section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {sec.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="p-3 bg-white rounded-lg border border-purple-100 space-y-2 shadow-2xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Title / Name (e.g. AWS Certified Solutions Architect)"
                              value={item.title}
                              onChange={(e) => updateCustomItemField(sec.id, itemIdx, 'title', e.target.value)}
                              className={inputStyles}
                            />
                            <input
                              type="text"
                              placeholder="Subtitle / Organization / Level"
                              value={item.subtitle}
                              onChange={(e) => updateCustomItemField(sec.id, itemIdx, 'subtitle', e.target.value)}
                              className={inputStyles}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Date / Year"
                              value={item.date}
                              onChange={(e) => updateCustomItemField(sec.id, itemIdx, 'date', e.target.value)}
                              className={inputStyles}
                            />
                            <input
                              type="text"
                              placeholder="Description / Note"
                              value={item.description}
                              onChange={(e) => updateCustomItemField(sec.id, itemIdx, 'description', e.target.value)}
                              className={`${inputStyles} sm:col-span-2`}
                            />
                          </div>
                          {sec.items.length > 1 && (
                            <button
                              onClick={() => removeCustomItem(sec.id, itemIdx)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove Item
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addCustomItem(sec.id)}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Item to {sec.title}</span>
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </div>

          {/* Column 3: Live Preview & PDF Actions (4 cols) */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Live Resume Preview</h2>
                <span className="text-xs text-gray-500 font-medium">{selectedTemplate?.name}</span>
              </div>

              {/* Scaled Live Document Preview Box */}
              <div className="bg-gray-200 rounded-xl p-2 sm:p-3 shadow-inner border border-gray-300 overflow-hidden">
                <div 
                  ref={previewRef}
                  className="bg-white rounded-lg shadow-lg overflow-y-auto max-h-[520px] aspect-[1/1.414] custom-scrollbar"
                >
                  <ResumeDocument
                    data={resumeData}
                    template={selectedTemplate}
                    theme={selectedTheme}
                    isCompact={true}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center space-x-2 shadow-sm transition-all transform active:scale-98"
                >
                  <Eye className="w-4 h-4" />
                  <span>Full Screen Preview</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center space-x-2 shadow-sm disabled:opacity-60 transition-all transform active:scale-98"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloading ? 'Generating PDF...' : 'Download High-Res PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High Quality Modal Preview for Viewing & PDF Export */}
      <Modal
        isOpen={showPreviewModal}
        onRequestClose={() => setShowPreviewModal(false)}
        contentLabel="Full Resume Preview"
        style={{
          overlay: {
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000
          },
          content: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            maxWidth: '850px',
            maxHeight: '92vh',
            width: '94%',
            overflowY: 'auto',
            border: 'none',
            background: 'transparent',
            padding: 0,
            zIndex: 1001
          }
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden relative">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20">
            <h3 className="font-semibold text-sm flex items-center space-x-2">
              <span>{selectedTemplate?.name} Preview</span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                {selectedTheme?.name}
              </span>
            </h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5"
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-100 flex justify-center">
            <div 
              ref={modalPreviewRef}
              className="bg-white shadow-xl w-full max-w-[800px] min-h-[1100px]"
            >
              <ResumeDocument
                data={resumeData}
                template={selectedTemplate}
                theme={selectedTheme}
                isCompact={false}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ResumeDesigner;