import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import type { InputJson } from '@personal/types/roadmap';

interface ImportRoadmapJsonInputProps {
  onGenerate: (input: InputJson) => void;
  loading: boolean;
  error: string | null;
}

const EXAMPLE_JSON: InputJson = {
  project: {
    name: 'Deep Learning Roadmap',
    description: 'Learn RNN, GRU and LSTM from fundamentals to implementation',
    startDate: '2026-09-15',
    deadline: '2026-11-15',
  },
  schedule: {
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    hoursPerDay: 3,
    bufferDays: 2,
  },
  rules: {
    includeRevision: true,
    includePractice: true,
    includeProjects: true,
    includeQuiz: true,
    includeSubtasks: true,
    defaultSubtaskCount: 2,
    defaultTaskHours: 1.5,
    milestoneGroupSize: 4,
  },
  phases: [
    {
      name: 'RNN Fundamentals',
      description: 'Master the basics of recurrent neural networks',
      topics: [
        { title: 'What is RNN and why it exists', estimatedHours: 1.5 },
        { title: 'RNN architecture and hidden state', estimatedHours: 2 },
        { title: 'Forward propagation through time', estimatedHours: 2 },
        { title: 'Backpropagation through time (BPTT)', estimatedHours: 2.5 },
        { title: 'Vanishing and exploding gradients', estimatedHours: 2 },
      ],
    },
    {
      name: 'GRU',
      description: 'Gated Recurrent Units',
      topics: [
        { title: 'Why GRU was introduced', estimatedHours: 1 },
        { title: 'GRU architecture and gates', estimatedHours: 2 },
        { title: 'Update gate and reset gate', estimatedHours: 2 },
        { title: 'Forward pass implementation', estimatedHours: 2.5 },
        { title: 'Training GRU networks', estimatedHours: 2 },
      ],
    },
    {
      name: 'LSTM',
      description: 'Long Short-Term Memory networks',
      topics: [
        { title: 'Why LSTM was introduced', estimatedHours: 1 },
        { title: 'LSTM architecture overview', estimatedHours: 2 },
        { title: 'Forget gate, input gate, output gate', estimatedHours: 3 },
        { title: 'Cell state mechanism', estimatedHours: 2 },
        { title: 'Forward propagation in LSTM', estimatedHours: 2.5 },
        { title: 'Training LSTM networks', estimatedHours: 2 },
        { title: 'LSTM vs GRU comparison', estimatedHours: 1.5 },
      ],
    },
  ],
};

function tryParseJson(text: string): { valid: boolean; data?: InputJson; error?: string } {
  try {
    const parsed = JSON.parse(text);
    return { valid: true, data: parsed };
  } catch (e: any) {
    return { valid: false, error: `Invalid JSON: ${e.message}` };
  }
}

export function ImportRoadmapJsonInput({ onGenerate, loading, error }: ImportRoadmapJsonInputProps) {
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => {
    setJsonText(value);
    if (value.trim()) {
      const result = tryParseJson(value);
      setParseError(result.valid ? null : result.error || 'Invalid JSON');
    } else {
      setParseError(null);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      const result = tryParseJson(text);
      setParseError(result.valid ? null : result.error || 'Invalid JSON');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleLoadExample = useCallback(() => {
    const text = JSON.stringify(EXAMPLE_JSON, null, 2);
    setJsonText(text);
    setParseError(null);
  }, []);

  const handleGenerate = useCallback(() => {
    const result = tryParseJson(jsonText);
    if (result.valid && result.data) {
      onGenerate(result.data);
    }
  }, [jsonText, onGenerate]);

  const hasJson = jsonText.trim().length > 0;
  const isValid = hasJson && !parseError;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-surface-200 mb-1.5">
          Paste your project JSON
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => handleChange(e.target.value)}
          placeholder='{"project": {"name": "...", ...}, "phases": [...]}'
          className="w-full h-80 bg-surface-800 border border-surface-700 rounded-xl p-4 font-mono text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
          spellCheck={false}
        />
      </div>

      {parseError && (
        <div className="flex items-start gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
          <AlertCircle size={16} className="text-danger-400 mt-0.5 shrink-0" />
          <p className="text-sm text-danger-300">{parseError}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
          <AlertCircle size={16} className="text-danger-400 mt-0.5 shrink-0" />
          <p className="text-sm text-danger-300">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          leftIcon={<Upload size={14} />}
        >
          Upload .json file
        </Button>
        <Button
          variant="secondary"
          onClick={handleLoadExample}
          leftIcon={<FileText size={14} />}
        >
          Load example
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!isValid || loading}
          loading={loading}
          className="sm:ml-auto"
          leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : undefined}
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </Button>
      </div>
    </div>
  );
}
