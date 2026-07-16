/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './ProjectRetrospectiveTab.module.css';
import { getRetrospective, saveRetrospective } from '../../api/projects';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function ProjectRetrospectiveTab({ projectId, projectStatus }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [designFeedback, setDesignFeedback] = useState('');
  const [processChanges, setProcessChanges] = useState('');
  
  // Array of { project_vendor_id, vendor_name, scope_of_work, rating, feedback }
  const [vendorRatings, setVendorRatings] = useState([]);
  
  const toast = useToast();

  const loadRetrospective = async () => {
    try {
      setLoading(true);
      const res = await getRetrospective(projectId);
      const data = res.data?.data || res.data;
      if (data) {
        const retro = data.retrospective;
        setWhatWentWell(retro?.what_went_well || '');
        setWhatWentWrong(retro?.what_went_wrong || '');
        setDesignFeedback(retro?.design_feedback || '');
        setProcessChanges(retro?.process_changes || '');
        
        setVendorRatings(data.vendorRatings || []);
      }
    } catch (err) {
      console.error('[ProjectRetrospectiveTab] load error:', err);
      toast.error('Failed to load project retrospective.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadRetrospective();
    }
  }, [projectId]);

  const handleRatingChange = (vendorId, ratingVal) => {
    setVendorRatings(prev => prev.map(v => 
      v.project_vendor_id === vendorId ? { ...v, rating: ratingVal } : v
    ));
  };

  const handleVendorFeedbackChange = (vendorId, feedbackText) => {
    setVendorRatings(prev => prev.map(v => 
      v.project_vendor_id === vendorId ? { ...v, feedback: feedbackText } : v
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const payload = {
        what_went_well: whatWentWell,
        what_went_wrong: whatWentWrong,
        design_feedback: designFeedback,
        process_changes: processChanges,
        vendor_ratings: vendorRatings.map(v => ({
          project_vendor_id: v.project_vendor_id,
          rating: v.rating || 5, // Default to 5 if not selected, or require selection?
          feedback: v.feedback
        }))
      };

      const res = await saveRetrospective(projectId, payload);
      const data = res.data?.data || res.data;
      if (data) {
        const retro = data.retrospective;
        setWhatWentWell(retro?.what_went_well || '');
        setWhatWentWrong(retro?.what_went_wrong || '');
        setDesignFeedback(retro?.design_feedback || '');
        setProcessChanges(retro?.process_changes || '');
        setVendorRatings(data.vendorRatings || []);
        toast.success('Project retrospective and lessons learned saved.');
      }
    } catch (err) {
      console.error('[ProjectRetrospectiveTab] save error:', err);
      toast.error('Failed to save retrospective.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading project retrospective...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Intro status card */}
      <div className={styles.statusPanel}>
        <div className={styles.statusIcon}>🧠</div>
        <div>
          <h3 className={styles.statusTitle}>Post-Project Retrospective</h3>
          <p className={styles.statusDesc}>
            Document key highlights, challenges, design feedback, process changes, and vendor reviews. This captures institutional knowledge to continuously improve execution quality on future projects.
          </p>
        </div>
      </div>

      {/* Retrospective Fields */}
      <div className={styles.sectionCard}>
        <h4 className={styles.sectionTitle}>Project Experience & Lessons Learned</h4>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>What Went Well</label>
            <p className={styles.fieldHelper}>List positive highlights, successful techniques, or vendor practices that worked well.</p>
            <textarea
              className={styles.textareaInput}
              value={whatWentWell}
              onChange={(e) => setWhatWentWell(e.target.value)}
              placeholder="e.g. Design reviews completed on time; carpenter vendor was proactive."
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>What Went Wrong & Retrospective Challenges</label>
            <p className={styles.fieldHelper}>Detail main bottlenecks, delays, design changes, and how they were resolved.</p>
            <textarea
              className={styles.textareaInput}
              value={whatWentWrong}
              onChange={(e) => setWhatWentWrong(e.target.value)}
              placeholder="e.g. Slow approval for plumbing specification drawings delayed phase kickoff."
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Design & Drawing Feedback</label>
            <p className={styles.fieldHelper}>Document feedback for design scope, revisions, measurements, and drawing register execution.</p>
            <textarea
              className={styles.textareaInput}
              value={designFeedback}
              onChange={(e) => setDesignFeedback(e.target.value)}
              placeholder="e.g. Room measurements need tighter tolerances before manufacturing."
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>Recommended Process Changes</label>
            <p className={styles.fieldHelper}>Suggest structural changes in templates, workflows, or rules for future projects.</p>
            <textarea
              className={styles.textareaInput}
              value={processChanges}
              onChange={(e) => setProcessChanges(e.target.value)}
              placeholder="e.g. Include drawing approval reminders in templates."
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Vendor Performance Ratings */}
      <div className={styles.sectionCard}>
        <h4 className={styles.sectionTitle}>Vendor Performance Ratings</h4>
        <p className={styles.sectionHelper}>
          Rate the performance of each vendor engaged on this project to help optimize future assignments.
        </p>

        {vendorRatings.length > 0 ? (
          <div className={styles.vendorsList}>
            {vendorRatings.map((vendor) => (
              <div key={vendor.project_vendor_id} className={styles.vendorCard}>
                <div className={styles.vendorHeader}>
                  <div>
                    <h5 className={styles.vendorName}>{vendor.vendor_name}</h5>
                    <span className={styles.vendorScope}>{vendor.scope_of_work || 'Scope not specified'}</span>
                  </div>
                  
                  {/* Star Rating Selector */}
                  <div className={styles.starContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`${styles.starButton} ${star <= (vendor.rating || 0) ? styles.starFilled : styles.starEmpty}`}
                        onClick={() => handleRatingChange(vendor.project_vendor_id, star)}
                      >
                        ★
                      </button>
                    ))}
                    <span className={styles.ratingText}>
                      {vendor.rating ? `${vendor.rating} / 5` : 'Not Rated'}
                    </span>
                  </div>
                </div>

                <div className={styles.vendorBody}>
                  <label className={styles.vendorFeedbackLabel}>Performance Notes & Comments:</label>
                  <textarea
                    className={styles.vendorFeedbackInput}
                    value={vendor.feedback || ''}
                    onChange={(e) => handleVendorFeedbackChange(vendor.project_vendor_id, e.target.value)}
                    placeholder="Provide notes on timeliness, workmanship quality, and professionalism."
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyVendors}>
            No vendors were engaged for this project. Engage vendors in the overview tab to enable performance reviews.
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={styles.actionFooter}>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving Retrospective...' : 'Save Retrospective & Ratings'}
        </Button>
      </div>
    </div>
  );
}
