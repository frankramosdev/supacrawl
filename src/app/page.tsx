'use client';

import { useState } from 'react';
import { Globe2, Link, Loader2, Copy, Volume2, VolumeX } from 'lucide-react';

const API_KEY = process.env.NEXT_PUBLIC_CRAWLER_API_KEY!;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!;

interface Metadata {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

interface ScrapeResult {
  success: boolean;
  data: {
    markdown?: string;
    html?: string;
    metadata?: Metadata;
  };
}

interface CrawlStatus {
  status: string;
  total: number;
  completed: number;
  creditsUsed: number;
  data: Array<{
    markdown?: string;
    html?: string;
    metadata?: Metadata;
  }>;
}

// Add this utility function
async function generateSpeech(text: string) {
  const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error('Failed to generate speech');
  }

  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | CrawlStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handleScrape = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html']
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response: ${text}`);
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to scrape URL');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCrawl = async () => {
    try {
      setLoading(true);
      setError(null);

      const crawlResponse = await fetch(`${API_BASE_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          url,
          limit: 100,
          scrapeOptions: { formats: ['markdown', 'html'] }
        })
      });

      const crawlText = await crawlResponse.text();
      let crawlResult;
      try {
        crawlResult = JSON.parse(crawlText);
      } catch {
        throw new Error(`Invalid JSON response: ${crawlText}`);
      }
      
      if (!crawlResponse.ok) {
        throw new Error(crawlResult.message || 'Failed to start crawl');
      }

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/crawl/${crawlResult.id}`, {
            headers: {
              'Authorization': `Bearer ${API_KEY}`
            }
          });

          const statusText = await statusResponse.text();
          let statusData;
          try {
            statusData = JSON.parse(statusText);
          } catch {
            throw new Error(`Invalid JSON response: ${statusText}`);
          }

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(pollInterval);
            setLoading(false);
            if (statusData.status === 'failed') {
              setError('Crawl failed');
            } else {
              setResult(statusData);
            }
          }
        } catch (err) {
          clearInterval(pollInterval);
          setError(err instanceof Error ? err.message : 'An error occurred');
          setLoading(false);
        }
      }, 5000);

      return () => clearInterval(pollInterval);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleTextToSpeech = async () => {
    if (!result) return;
    
    try {
      let text = '';
      
      if ('data' in result && Array.isArray(result.data)) {
        const firstResult = result.data[0];
        text = firstResult?.metadata?.description || '';
      } else if ('data' in result && 'metadata' in result.data) {
        text = result.data.metadata?.description || '';
      }

      if (!text) {
        throw new Error('No text available to convert to speech');
      }

      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }

      setLoading(true);
      const audioUrl = await generateSpeech(text);
      
      const audio = new Audio(audioUrl);
      setAudioElement(audio);
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setAudioElement(null);
      });

      audio.addEventListener('error', () => {
        setError('Error playing audio');
        setIsPlaying(false);
        setAudioElement(null);
      });

      setIsPlaying(true);
      await audio.play();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert text to speech');
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
      setAudioElement(null);
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Supacrawl
            </h1>
            <p className="text-slate-400 text-lg">
              Extract clean, structured data from any website for LLMs
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
            <div className="space-y-6">
              {/* URL Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Link className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                  placeholder="Enter URL to scrape"
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  aria-label="URL to scrape"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleScrape}
                  disabled={loading || !url}
                  className="relative group px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Scrape single URL"
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Link className="h-5 w-5" />
                    )}
                    {loading ? 'Processing...' : 'Scrape URL'}
                  </span>
                </button>

                <button
                  onClick={handleCrawl}
                  disabled={loading || !url}
                  className="relative group px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Crawl entire website"
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Globe2 className="h-5 w-5" />
                    )}
                    {loading ? 'Processing...' : 'Crawl Website'}
                  </span>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="animate-in fade-in slide-in-from-top-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400" role="alert">
                  {error}
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-semibold text-slate-200">Results</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={isPlaying ? stopAudio : handleTextToSpeech}
                        disabled={loading}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label={isPlaying ? "Stop audio" : "Convert to speech"}
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isPlaying ? (
                          <VolumeX className="h-5 w-5" />
                        ) : (
                          <Volume2 className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const resultText = document.getElementById('resultsText')?.querySelector('pre')?.textContent;
                          if (resultText) {
                            navigator.clipboard.writeText(resultText)
                              .catch(err => console.error('Failed to copy text:', err));
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label="Copy results"
                      >
                        <Copy className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div id="resultsText" className="relative group">
                    <div className="absolute -inset-px bg-gradient-to-r from-blue-500 to-emerald-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <pre className="relative p-4 bg-slate-800/90 rounded-xl overflow-auto text-sm text-slate-300">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 