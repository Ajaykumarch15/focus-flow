import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileJson } from 'lucide-react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { ImportRoadmapJsonInput } from '@personal/components/roadmap/ImportRoadmapJsonInput';
import { ImportRoadmapPreview } from '@personal/components/roadmap/ImportRoadmapPreview';
import { Button } from '@shared/components/ui/Button';
import type { InputJson } from '@personal/types/roadmap';

export function ImportRoadmapPage() {
  const navigate = useNavigate();
  const {
    generatedPlan,
    generateLoading,
    importLoading,
    generatePlan,
    importRoadmap,
    clearGeneratedPlan,
    error,
  } = useRoadmapStore();

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [warnings, setWarnings] = useState<any[]>([]);

  const handleGenerate = useCallback(async (input: InputJson) => {
    try {
      const result = await generatePlan(input);
      setWarnings(result.warnings);
      setStep('preview');
    } catch (err) {
      // error is set in store
    }
  }, [generatePlan]);

  const handleImport = useCallback(async () => {
    if (!generatedPlan) return;
    try {
      const result = await importRoadmap(generatedPlan);
      navigate(`/personal/roadmaps/${result.roadmapId}`);
    } catch (err) {
      // error is set in store
    }
  }, [generatedPlan, importRoadmap, navigate]);

  const handleBack = useCallback(() => {
    clearGeneratedPlan();
    setStep('input');
    setWarnings([]);
  }, [clearGeneratedPlan]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/personal/roadmaps')}
          leftIcon={<ArrowLeft size={16} />}
        >
          Roadmaps
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <FileJson size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">
              Import Roadmap from JSON
            </h1>
            <p className="text-sm text-surface-400 mt-0.5">
              {step === 'input'
                ? 'Paste your project JSON to generate a roadmap'
                : 'Review and edit before creating'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6" role="progressbar" aria-valuenow={step === 'input' ? 1 : 2} aria-valuemin={1} aria-valuemax={2}>
          <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${step === 'input' || step === 'preview' ? 'bg-brand-500' : 'bg-surface-800'}`} />
          <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${step === 'preview' ? 'bg-brand-500' : 'bg-surface-800'}`} />
        </div>

        {step === 'input' && (
          <ImportRoadmapJsonInput
            onGenerate={handleGenerate}
            loading={generateLoading}
            error={error}
          />
        )}

        {step === 'preview' && generatedPlan && (
          <ImportRoadmapPreview
            plan={generatedPlan}
            warnings={warnings}
            onImport={handleImport}
            onBack={handleBack}
            importing={importLoading}
          />
        )}
      </motion.div>
    </div>
  );
}
