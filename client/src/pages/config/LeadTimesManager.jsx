import React, { useState, useEffect } from 'react';
import { getLeadTimes, saveLeadTime } from '../../api/vendorLeadTimes';
import { useToast } from '../../store/toastContext';
import { Button, Spinner } from '../../components/ui';
import styles from './LeadTimesManager.module.css';

const CATEGORIES_CONFIG = [
  { key: 'plywood', name: 'Plywood & Boards', icon: '🪵', desc: 'Commercial, BWR, and Marine grade plywood, MDF, and blockboards.' },
  { key: 'hardware', name: 'Hardware & Fittings', icon: '🔩', desc: 'Door hinges, drawer slides, locks, screws, handles, and connectors.' },
  { key: 'laminate', name: 'Laminates & Veneers', icon: '📄', desc: 'Decorative surfaces, mica sheets, edgeband tapes, and wood veneers.' },
  { key: 'paint', name: 'Paint & Polishing', icon: '🎨', desc: 'Wall primers, emulsions, wood polishes, thinners, and brushes.' },
  { key: 'electrical', name: 'Electrical Fittings', icon: '⚡', desc: 'Wires, conduits, switchboards, LED drivers, lights, and sockets.' },
  { key: 'plumbing', name: 'Plumbing & Sanitary', icon: '🚰', desc: 'Pipes, solvent cements, taps, washbasins, and toilet fixtures.' },
  { key: 'modular', name: 'Modular Woodwork', icon: '🏢', desc: 'Pre-fabricated kitchen cabinets, wardrobe carcasses, and shutters.' },
  { key: 'general', name: 'General Materials', icon: '📦', desc: 'Standard building materials, adhesives, tape, and protective sheets.' }
];

export default function LeadTimesManager() {
  const [leadTimes, setLeadTimes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getLeadTimes();
      if (res.data?.success) {
        const rawList = res.data.data || [];
        const mapped = {};
        rawList.forEach(item => {
          if (item.vendor_id === null) {
            mapped[item.material_category] = item.lead_time_days;
          }
        });
        setLeadTimes(mapped);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lead times configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeadTimeChange = (category, value) => {
    setLeadTimes(prev => ({
      ...prev,
      [category]: Math.max(0, parseInt(value) || 0)
    }));
  };

  const handleSave = async (category) => {
    const days = leadTimes[category] !== undefined ? leadTimes[category] : 5;
    setSavingKey(category);
    try {
      const res = await saveLeadTime({
        materialCategory: category,
        leadTimeDays: days,
        vendorId: null
      });
      if (res.data?.success) {
        toast.success(`Updated lead time for ${category} to ${days} days.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update lead time for ${category}.`);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="md" />
        <p style={{ marginTop: '8px' }}>Loading category configurations...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendor Lead Times Configuration</h1>
          <p className={styles.subtitle}>
            Set default lead times (in days) per material category. The system automatically subtracts these values from the site required date to calculate the Latest Order Date for Purchase Requests.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {CATEGORIES_CONFIG.map(cat => {
          const daysVal = leadTimes[cat.key] !== undefined ? leadTimes[cat.key] : '';
          const isSaving = savingKey === cat.key;

          return (
            <div key={cat.key} className={cat.key === 'modular' ? `${styles.card} ${styles.highlight}` : styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.icon}>{cat.icon}</span>
                <div>
                  <h3 className={styles.cardTitle}>{cat.name}</h3>
                  <span className={styles.badge}>{cat.key}</span>
                </div>
              </div>
              <p className={styles.desc}>{cat.desc}</p>
              
              <div className={styles.actionsBlock}>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={daysVal}
                    onChange={e => handleLeadTimeChange(cat.key, e.target.value)}
                    placeholder="5"
                    className={styles.numInput}
                  />
                  <span className={styles.unit}>Days Lead Time</span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleSave(cat.key)}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
