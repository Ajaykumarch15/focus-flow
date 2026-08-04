import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bug, CheckCircle2, Lightbulb, HelpCircle, Save } from 'lucide-react';
import { WorkLog, useWorkLogStore } from '../../store/useWorkLogStore';
import { Textarea } from '../../components/ui/Textarea';
import { Spinner } from '../../components/ui/Spinner';

interface ProblemFlowEditorProps {
  workLog: WorkLog;
}

export function ProblemFlowEditor({ workLog }: ProblemFlowEditorProps) {
  const { updateNestedField, updateField } = useWorkLogStore();
  const flow = workLog.problemFlow || { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: '' };

  const [problem, setProblem] = useState(flow.problem || workLog.problem || '');
  const [investigation, setInvestigation] = useState(flow.investigation || '');
  const [rootCause, setRootCause] = useState(flow.rootCause || '');
  const [solution, setSolution] = useState(flow.solution || '');
  const [lessonsLearned, setLessonsLearned] = useState(flow.lessonsLearned || '');
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    setProblem(flow.problem || workLog.problem || '');
    setInvestigation(flow.investigation || '');
    setRootCause(flow.rootCause || '');
    setSolution(flow.solution || '');
    setLessonsLearned(flow.lessonsLearned || '');
  }, [workLog._id]);

  const handleSave = async (childField: string, value: string) => {
    setSavingField(childField);
    try {
      await updateNestedField(workLog._id, 'problemFlow', childField, value);
      if (childField === 'problem') {
        await updateField(workLog._id, 'problem', value);
      }
    } finally {
      setSavingField(null);
    }
  };

  const STAGES = [
    { key: 'problem', label: '1. Problem Statement', icon: Bug, placeholder: 'What issue or bug are you attempting to solve?', value: problem, setter: setProblem, color: 'text-red-400', border: 'border-red-500/20' },
    { key: 'investigation', label: '2. Investigation & Findings', icon: Search, placeholder: 'What tests, logs, or steps were taken to investigate?', value: investigation, setter: setInvestigation, color: 'text-amber-400', border: 'border-amber-500/20' },
    { key: 'rootCause', label: '3. Root Cause Analysis', icon: HelpCircle, placeholder: 'What was the exact underlying cause of the defect?', value: rootCause, setter: setRootCause, color: 'text-purple-400', border: 'border-purple-500/20' },
    { key: 'solution', label: '4. Solution & Implementation', icon: CheckCircle2, placeholder: 'How was the problem resolved? (Architecture / code fix)', value: solution, setter: setSolution, color: 'text-emerald-400', border: 'border-emerald-500/20' },
    { key: 'lessonsLearned', label: '5. Lessons Learned', icon: Lightbulb, placeholder: 'Key takeaways or preventative measures for the future?', value: lessonsLearned, setter: setLessonsLearned, color: 'text-sky-400', border: 'border-sky-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
          <Bug size={18} className="text-red-400" />
          Engineering Problem & Solution Lifecycle
        </h3>
        <p className="text-xs text-surface-400">
          Document technical challenges step-by-step from initial bug discovery to root cause and lessons learned.
        </p>
      </div>

      <div className="space-y-4">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const isSaving = savingField === stage.key;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border ${stage.border} bg-surface-900/60 space-y-2`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={stage.color} />
                  <span className="text-xs font-semibold text-surface-100">{stage.label}</span>
                </div>
                {isSaving ? (
                  <Spinner size={12} className="text-brand-400" />
                ) : (
                  <Save size={12} className="text-surface-600" />
                )}
              </div>
              <Textarea
                className="text-sm w-full resize-none rounded-lg font-sans leading-relaxed"
                rows={3}
                placeholder={stage.placeholder}
                value={stage.value}
                onChange={e => stage.setter(e.target.value)}
                onBlur={e => handleSave(stage.key, e.target.value)}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
