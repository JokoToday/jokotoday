import { useState, useEffect } from 'react';
import { getAllLabels, CMSLabel } from '../lib/cmsService';

export function useCMSLabels() {
  const [labels, setLabels] = useState<Record<string, CMSLabel>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      setLoading(true);
      const data = await getAllLabels();
      const labelMap: Record<string, CMSLabel> = {};
      data.forEach(label => {
        labelMap[label.key] = label;
      });
      setLabels(labelMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load labels'));
    } finally {
      setLoading(false);
    }
  };

  const getLabel = (key: string, language: 'en' | 'th' | 'zh', fallback: string = ''): string => {
    const label = labels[key];
    if (!label) return fallback;
    if (language === 'th') return label.text_th;
    if (language === 'zh') return label.text_zh || label.text_en;
    return label.text_en;
  };

  return { labels, loading, error, getLabel };
}
