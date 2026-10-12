import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useDropzone } from 'react-dropzone';
import { resumeService, jobService } from '../services/api';
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Search, 
  TrendingUp,
  CheckCircle,
  X,
  Download,
  Plus,
  AlertCircle
} from 'lucide-react';

// Helper function to format the date string from the server
const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ResumeAnalyzer = () => {
  const [step, setStep] = useState(1);
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [allExistingResumes, setAllExistingResumes] = useState([]);
  const [jobDescription, setJobDescription] = useState({
    title: '',
    description: '',
    requirements: ''
  });
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Fetch all existing user resumes from DB
  const fetchExistingResumes = useCallback(async () => {
    try {
      const data = await resumeService.getAllResumes();
      if (data && Array.isArray(data.resumes)) {
        setAllExistingResumes(data.resumes);
      }
    } catch (err) {
      console.error("Failed to fetch existing resumes:", err);
    }
  }, []);

  useEffect(() => {
    fetchExistingResumes();
  }, [fetchExistingResumes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/octet-stream': ['.pdf', '.docx', '.doc']
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setUploadLoading(true);
        setUploadError(null);
        try {
          const result = await resumeService.uploadResumes(acceptedFiles);
          const newlyUploaded = result?.resumes || [];

          setUploadedResumes(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const filteredNew = newlyUploaded.filter(r => r && r.id && !existingIds.has(r.id));
            return [...prev, ...filteredNew];
          });

          await fetchExistingResumes();
        } catch (error) {
          console.error('Upload failed:', error);
          const detail = error.response?.data?.detail || "Upload experienced an issue. Attempting to retrieve saved resumes...";
          setUploadError(detail);

          // Fallback: sync from DB in case backend inserted files before timing out or throwing warning
          try {
            const data = await resumeService.getAllResumes();
            if (data && Array.isArray(data.resumes) && data.resumes.length > 0) {
              setUploadedResumes(prev => {
                const existingIds = new Set(prev.map(r => r.id));
                const recoverables = data.resumes.filter(r => !existingIds.has(r.id));
                return [...prev, ...recoverables];
              });
            }
          } catch (e) {
            console.error("Recovery sync failed:", e);
          }
        } finally {
          setUploadLoading(false);
        }
      }
    }
  });

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...jobDescription,
        resume_ids: uploadedResumes.map(r => r.id) // send only selected uploads
      };
      const results = await jobService.analyzeJob(payload);
      setAnalysisResults(results);
      setStep(3);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeResume = (index) => {
    setUploadedResumes(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExistingResume = (resume) => {
    setUploadedResumes(prev => {
      const exists = prev.some(r => r.id === resume.id);
      if (exists) {
        return prev.filter(r => r.id !== resume.id);
      } else {
        return [...prev, resume];
      }
    });
  };

  const selectAllExistingResumes = () => {
    setUploadedResumes(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = allExistingResumes.filter(r => !existingIds.has(r.id));
      return [...prev, ...toAdd];
    });
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (score) => {
    if (score >= 0.8) return 'Excellent Match';
    if (score >= 0.6) return 'Good Match';
    return 'Needs Improvement';
  };

  const handleExportResults = () => {
    if (!analysisResults) return;

    // Prepare data for Excel
    const data = analysisResults.ranked_resumes.map(resume => ({
      Candidate: resume.filename,
      'Uploaded Date': formatDate(resume.uploaded_at),
      'Match %': `${(resume.similarity_score * 100).toFixed(2)}%`,
      'Missing Skills': resume.missing_skills && resume.missing_skills.length > 0
        ? resume.missing_skills.join(', ')
        : 'None',
      'Improvements Needed': resume.improvements || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const fileName = 'resume-analysis-results.xlsx';
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), fileName);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Analyzer</h1>
          <p className="text-gray-600">Upload single or multiple resumes to get AI-powered matching insights</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, title: 'Upload Resumes', icon: Upload },
              { step: 2, title: 'Job Description', icon: Briefcase },
              { step: 3, title: 'Analysis Results', icon: TrendingUp }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = step === item.step;
              const isCompleted = step > item.step;
              
              return (
                <div key={item.step} className="flex items-center space-x-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-600' : isActive ? 'bg-blue-600' : 'bg-gray-300'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className={`font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Upload Resumes */}
        {step === 1 && (
          <div className="bg-white rounded-xl p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Resumes</h2>
            
            {uploadError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{uploadError}</p>
                </div>
                <button onClick={() => setUploadError(null)} className="text-amber-600 hover:text-amber-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Drop resume files here, or click to select
              </h3>
              <p className="text-gray-600 mb-4">
                Upload <strong>one or multiple</strong> PDF or DOCX files (up to 10MB each)
              </p>
              {uploadLoading && (
                <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Processing & Uploading Resumes...
                </div>
              )}
            </div>

            {/* Selected Resumes for Analysis */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Selected Resumes for Analysis ({uploadedResumes.length})
                </h3>
                {uploadedResumes.length > 0 && (
                  <button
                    onClick={() => setUploadedResumes([])}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {uploadedResumes.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                  No resumes selected yet. Drop files above or select from your uploaded library below.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {uploadedResumes.map((resume, index) => (
                    <div key={resume.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="overflow-hidden">
                          <p className="font-medium text-gray-900 text-sm truncate">{resume.filename}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {resume.text_preview || 'Ready for analysis'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeResume(index)}
                        className="text-red-600 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50"
                        title="Remove from analysis"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previously Uploaded Resumes Library */}
            {allExistingResumes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium text-gray-800">
                    Your Previously Uploaded Resumes ({allExistingResumes.length})
                  </h3>
                  <button
                    onClick={selectAllExistingResumes}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Select All</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                  {allExistingResumes.map((resume) => {
                    const isSelected = uploadedResumes.some(r => r.id === resume.id);
                    return (
                      <div
                        key={resume.id}
                        onClick={() => toggleExistingResume(resume)}
                        className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-900'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="text-xs font-medium truncate" title={resume.filename}>
                            {resume.filename}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action / Continue Button */}
            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={uploadedResumes.length === 0}
                className="bg-blue-600 text-white px-8 py-3.5 rounded-lg font-semibold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center space-x-2"
              >
                <span>
                  Continue to Job Description {uploadedResumes.length > 0 ? `(${uploadedResumes.length} ${uploadedResumes.length === 1 ? 'Resume' : 'Resumes'})` : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Job Description */}
        {step === 2 && (
          <div className="bg-white rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Job Description</h2>
              <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded-full">
                Analyzing {uploadedResumes.length} {uploadedResumes.length === 1 ? 'resume' : 'resumes'}
              </span>
            </div>
            
            <form onSubmit={handleJobSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jobDescription.title}
                  onChange={(e) => setJobDescription({...jobDescription, title: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Senior Software Engineer"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description
                </label>
                <textarea
                  value={jobDescription.description}
                  onChange={(e) => setJobDescription({...jobDescription, description: e.target.value})}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the role, responsibilities, and what the ideal candidate would do..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements & Qualifications
                </label>
                <textarea
                  value={jobDescription.requirements}
                  onChange={(e) => setJobDescription({...jobDescription, requirements: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="List the required skills, experience, education, and qualifications..."
                  required
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-gray-600 hover:text-gray-700 font-medium"
                >
                  Back to Upload
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  <Search className="w-5 h-5" />
                  <span>Analyze Resumes ({uploadedResumes.length})</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Analysis Results */}
        {step === 3 && analysisResults && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Analysis Results</h2>
                <div className="text-sm text-gray-500">
                  {analysisResults.total_resumes} resumes analyzed
                </div>
              </div>

              <div className="space-y-4">
                {analysisResults.ranked_resumes.map((resume, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{resume.filename}</h3>
                          <p className="text-sm text-gray-500">
                            Uploaded: {formatDate(resume.uploaded_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(resume.similarity_score)}`}>
                          {(resume.similarity_score * 100).toFixed(1)}% Match
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {getScoreLabel(resume.similarity_score)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Resume Preview</h4>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {resume.text_preview}
                      </p>
                    </div>
                    
                    <div className="flex justify-end">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1">
                        <Download className="w-4 h-4" />
                        <span>View Full Resume</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => {
                    setStep(1);
                    setUploadedResumes([]); // Clear session uploads
                    setAnalysisResults(null); // Clear results
                    setJobDescription({ title: '', description: '', requirements: '' }); // Clear job form
                  }}
                  className="text-gray-600 hover:text-gray-700 font-medium"
                >
                  Start New Analysis
                </button>
                
                <button
                  onClick={handleExportResults}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Export Results</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeAnalyzer;