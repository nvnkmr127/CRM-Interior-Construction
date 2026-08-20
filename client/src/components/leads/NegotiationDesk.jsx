/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function NegotiationDesk({ leadId, lead, onUpdate }) {
  const toast = useToast();
  
  // Parse initial custom fields
  let customFields = lead?.custom_fields;
  while (typeof customFields === 'string') {
    try {
      customFields = JSON.parse(customFields);
    } catch (e) {
      customFields = {};
      break;
    }
  }
  if (!customFields || typeof customFields !== 'object') {
    customFields = {};
  }
  const negotiation = customFields?.negotiation || {};
  
  // Track whether negotiation details are saved
  const hasSavedDetails = !!(negotiation.quoted_price || negotiation.target_price);

  const [isEditing, setIsEditing] = useState(!hasSavedDetails);
  const [quotedPrice, setQuotedPrice] = useState(negotiation.quoted_price || '');
  const [targetPrice, setTargetPrice] = useState(negotiation.target_price || '');
  const [notes, setNotes] = useState(negotiation.notes || '');
  const [loading, setLoading] = useState(false);
  const [activeTacticTab, setActiveTacticTab] = useState('all');

  React.useEffect(() => {
    let customFields = lead?.custom_fields;
    while (typeof customFields === 'string') {
      try {
        customFields = JSON.parse(customFields);
      } catch (e) {
        customFields = {};
        break;
      }
    }
    if (!customFields || typeof customFields !== 'object') {
      customFields = {};
    }
    const updatedNegotiation = customFields?.negotiation || {};
    setQuotedPrice(updatedNegotiation.quoted_price || '');
    setTargetPrice(updatedNegotiation.target_price || '');
    setNotes(updatedNegotiation.notes || '');
    
    // Automatically switch modes based on whether data exists
    const hasData = !!(updatedNegotiation.quoted_price || updatedNegotiation.target_price);
    setIsEditing(!hasData);
  }, [lead]);

  const gap = (parseFloat(quotedPrice) || 0) - (parseFloat(targetPrice) || 0);
  const discountPercent = gap > 0 && parseFloat(quotedPrice) ? ((gap / parseFloat(quotedPrice)) * 100).toFixed(1) : 0;

  // Extract scopes from lead details to render contextual recommendations
  const getProductScopes = () => {
    let scopes = [];
    if (lead?.scope) {
      if (Array.isArray(lead.scope)) {
        scopes = lead.scope;
      } else if (typeof lead.scope === 'string') {
        try {
          const parsed = JSON.parse(lead.scope);
          scopes = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          // Check for comma separated string or simple string
          scopes = lead.scope.split(',').map(s => s.trim().toLowerCase());
        }
      }
    }
    return scopes.map(s => s.toLowerCase());
  };

  const productScopes = getProductScopes();

  const handleSave = async () => {
    if (!quotedPrice || !targetPrice) {
      toast.error('Both Quoted Price and Target Price are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.patch(`/leads/${leadId}/negotiation`, {
        quoted_price: quotedPrice,
        target_price: targetPrice,
        notes: notes
      });
      if (res.data.success) {
        toast.success('Negotiation details saved');
        setIsEditing(false);
        if (onUpdate) {
          onUpdate(res.data.data);
        }
      }
    } catch (e) {
      toast.error('Failed to save negotiation details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/leads/${leadId}/negotiation`, {
        quoted_price: null,
        target_price: null,
        notes: ''
      });
      if (res.data.success) {
        toast.success('Negotiation details removed');
        setQuotedPrice('');
        setTargetPrice('');
        setNotes('');
        setIsEditing(true);
        if (onUpdate) {
          onUpdate(res.data.data);
        }
      }
    } catch (e) {
      toast.error('Failed to delete negotiation details');
    } finally {
      setLoading(false);
    }
  };

  // Define recommendations repository based on scope keys
  const getRecommendations = () => {
    const recs = [];
    const lowerScopes = productScopes;

    const hasScope = (keyphrase) => {
      return lowerScopes.some(s => s.includes(keyphrase));
    };

    // 1. Kitchen specific tips
    if (hasScope('kitchen') || hasScope('cook') || hasScope('pantry') || hasScope('dining')) {
      recs.push({
        type: 'add-ons',
        title: '🍳 Complimentary Kitchen Accessories',
        text: 'Offer a complimentary premium chimney upgrade or smart pull-out tandem drawers (worth ₹18k cost, but valued at ₹40k+ by the user) to bridge the price difference without cutting into woodwork margins.'
      });
      recs.push({
        type: 'scope',
        title: '🍽️ Countertop Optimization',
        text: 'Suggest transitioning countertop materials from premium exotic Quartz to high-grade local Granite or Engineered Quartz. This alone can save ₹25k to ₹45k.'
      });
      recs.push({
        type: 'warranty',
        title: '🛡️ Lifetime Hinge Warranty Upgrade',
        text: 'Offer to upgrade standard soft-close cabinet hinges to lifetime-warrantied Blum/Hettich hinges. High perceived builder assurance value, minimal direct material cost.'
      });
    }

    // 2. Bedroom/Wardrobe specific tips
    if (hasScope('bedroom') || hasScope('wardrobe') || hasScope('storage') || hasScope('cabinet') || hasScope('loft')) {
      recs.push({
        type: 'add-ons',
        title: '👚 Wardrobe Accessories Add-On',
        text: 'Bundle built-in profile LED strip lighting or pull-out tie/sari racks inside the wardrobes instead of lowering wood square footage price.'
      });
      recs.push({
        type: 'scope',
        title: '🚪 Sliding to Swing Doors Switch',
        text: 'If sliding doors are configured, suggest switching to swing doors for wardrobes. This can reduce raw fitting & profile costs by 15% to 20%.'
      });
    }

    // 3. Living room specific tips
    if (hasScope('living') || hasScope('tv') || hasScope('foyer') || hasScope('crockery')) {
      recs.push({
        type: 'add-ons',
        title: '📺 Living TV Console Additions',
        text: 'Propose adding integrated floating ledge drawers or back-lit acrylic diffuser sheets to enhance visual impact, offsetting layout compromises.'
      });
      recs.push({
        type: 'scope',
        title: '🪵 Wall Paneling Optimization',
        text: 'Recommend replacing veneer wall paneling designs behind the TV unit with premium paint finishes, charcoal louvers, or texture wallpapers to save up to ₹35k.'
      });
    }

    // 4. Office/Study specific tips
    if (hasScope('office') || hasScope('study')) {
      recs.push({
        type: 'add-ons',
        title: '🔌 Intelligent Cable Management',
        text: 'Offer a complimentary built-in desktop cable manager or premium wire organization kit (worth ₹5k) to retain the contract value.'
      });
      recs.push({
        type: 'scope',
        title: '📁 Open Bookshelves Switch',
        text: 'Suggest changing closed glass-door cabinets to floating open wooden shelves for book storage, lowering material and glass fabrication costs by ₹15k.'
      });
    }

    // 5. Ceiling/Lighting specific tips
    if (hasScope('ceiling') || hasScope('lighting') || hasScope('light')) {
      recs.push({
        type: 'add-ons',
        title: '💡 Complimentary indirect COB LED strips',
        text: 'Offer to include high-grade, long-lasting ambient COB LED strip lights inside the ceiling coves at zero extra cost to sweeten the deal.'
      });
      recs.push({
        type: 'scope',
        title: '📐 Border Ceiling Simplification',
        text: 'Suggest replacing double-step coffered ceiling designs with clean perimeter/border false ceilings, reducing boards, channel framing, and labor costs by 20%.'
      });
    }

    // 6. Flooring/Painting specific tips
    if (hasScope('flooring') || hasScope('paint') || hasScope('painting')) {
      recs.push({
        type: 'add-ons',
        title: '🛡️ Waterproof Primer Shield Upgrade',
        text: 'Provide a complimentary upgrade to premium anti-dampness base primer coat for all walls to secure the primary contract.'
      });
      recs.push({
        type: 'scope',
        title: '🎨 Single Accent Wall Strategy',
        text: 'Instead of textured paint or wallpapers on multiple walls, recommend focus textures on a single highlight wall per room and solid emulsions elsewhere.'
      });
    }

    // 7. Pooja Room specific tips
    if (hasScope('pooja') || hasScope('prayer') || hasScope('mandir') || hasScope('temple')) {
      recs.push({
        type: 'add-ons',
        title: '🪔 CNC Backlit Jali Upgrade',
        text: 'Offer a free backlit CNC woodwork Jali panel for the temple backdrop to secure the pooja room package without lowering prices.'
      });
      recs.push({
        type: 'scope',
        title: '🪵 Carving to Laminate Trim Switch',
        text: 'Suggest transitioning pooja unit drawer bases from custom carved solid teakwood to premium laminate drawer bases with wooden border trims.'
      });
    }

    // 8. Full House specific tips
    if (hasScope('fullhouse') || hasScope('full house') || hasScope('full_house') || hasScope('villa') || hasScope('apartment')) {
      recs.push({
        type: 'add-ons',
        title: '💡 Smart Home Automation Integration',
        text: 'Offer a complimentary smart-lighting panel or automated sensor controls for the living room and entryway to close the whole-house deal.'
      });
      recs.push({
        type: 'scope',
        title: '🚪 Phased Work Sequencing Plan',
        text: 'Propose focusing Phase 1 of execution on critical functional spaces (Kitchen, Master Bedroom) while deferring guest rooms or study rooms to a Phase 2 contract.'
      });
      recs.push({
        type: 'warranty',
        title: '🛡️ Whole-Home Extended Warranty',
        text: 'Offer a 5-year comprehensive warranty on all woodwork across the entire house, giving high reassurance at zero upfront material cost.'
      });
    }

    // Fallback default recommendations if no specific scopes match
    if (recs.length === 0) {
      recs.push({
        type: 'add-ons',
        title: '🎁 Value-Add Hardware Upgrades',
        text: 'Offer complimentary smart home automation sensors or profile handles (worth ₹12k cost, ₹30k perceived value) to secure the current quoted contract value.'
      });
      recs.push({
        type: 'scope',
        title: '📐 Phased Scope Adjustments',
        text: 'Suggest postponing guest bedrooms or non-essential study room wardrobes to a separate Phase 2 work contract next season to bring down current BOQ total.'
      });
      recs.push({
        type: 'warranty',
        title: '🛡️ Structural Warranty Extension',
        text: 'Offer an extension of woodwork structural warranty from 3 to 5 years. High client reassurance score with minimal direct material overhead cost.'
      });
    }

    return recs;
  };

  const allRecommendations = getRecommendations();
  const filteredRecommendations = activeTacticTab === 'all' 
    ? allRecommendations 
    : allRecommendations.filter(r => r.type === activeTacticTab);

  return (
    <div className="space-y-6">
      {/* 1. Header Desk Panel with Status Badges (Matching CRM styling) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-[var(--color-text-h)] flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">🤝</span>
            Negotiation Desk
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Analyze pricing gaps, model profit margins, and review high-yield closing tactics.
          </p>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          {hasSavedDetails && (
            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider shadow-sm border ${
              gap === 0 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : gap > 0 
                ? 'bg-orange-50 border-orange-200 text-orange-700 animate-pulse' 
                : 'bg-indigo-50 border-indigo-200 text-indigo-750'
            }`}>
              {gap === 0 ? '✓ Fully Aligned' : gap > 0 ? `⚠️ Price Gap: ₹${gap.toLocaleString()}` : '⚡ Target Exceeded'}
            </span>
          )}
          
          {!isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                ✏️ Edit Terms
              </Button>
              <Button variant="outline" size="sm" className="text-red-650 hover:bg-red-50" onClick={handleDelete}>
                🗑️ Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Desk Details Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT TWO COLUMNS: Financial Cards or Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)] transition-all">
            {isEditing ? (
              // EDIT MODE VIEW
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50/40 hover:bg-blue-50/70 p-5 rounded-xl border border-blue-100 transition-colors">
                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2.5">Our Quoted Price</label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-blue-300">₹</span>
                      <input 
                        type="number" 
                        value={quotedPrice}
                        onChange={e => setQuotedPrice(e.target.value)}
                        className="w-full text-3xl font-black text-gray-900 bg-transparent border-b-2 border-blue-200 focus:border-blue-500 focus:outline-none focus:ring-0 pb-1"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-2 block">Typically matches the final estimate or BOQ draft.</span>
                  </div>
                  
                  <div className="bg-orange-50/40 hover:bg-orange-50/70 p-5 rounded-xl border border-orange-100 transition-colors">
                    <label className="block text-xs font-bold text-orange-800 uppercase tracking-wider mb-2.5">Customer Target Price</label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-orange-300">₹</span>
                      <input 
                        type="number" 
                        value={targetPrice}
                        onChange={e => setTargetPrice(e.target.value)}
                        className="w-full text-3xl font-black text-gray-900 bg-transparent border-b-2 border-orange-200 focus:border-orange-500 focus:outline-none focus:ring-0 pb-1"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-2 block">The maximum budget limit expressed by the client.</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end border-t border-[var(--color-border)] pt-5">
                  <div>
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider block mb-1">Estimated Gap</span>
                    <span className={`text-2xl font-extrabold ${gap > 0 ? 'text-red-650' : gap < 0 ? 'text-emerald-650' : 'text-[var(--color-text-h)]'}`}>
                      {gap > 0 ? `₹${gap.toLocaleString()}` : gap < 0 ? `₹${Math.abs(gap).toLocaleString()} Ahead` : 'Aligned'}
                    </span>
                    {gap > 0 && <span className="text-xs text-red-500 block mt-1">Requires {discountPercent}% margin adjustment</span>}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">Negotiation Tactics & Notes</label>
                    <textarea 
                      rows={2}
                      className="w-full text-sm border border-[var(--color-border)] rounded-xl p-3 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 shadow-sm"
                      placeholder="e.g. Discussed removing premium quartz counters or shifting wardrobes to phase 2 to close the gap..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end gap-2.5 border-t border-[var(--color-border)] pt-4">
                  {hasSavedDetails && (
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Terms'}
                  </Button>
                </div>
              </div>
            ) : (
              // READ-ONLY / DISPLAY MODE
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50/30 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Our Quoted Price</span>
                    <span className="text-3xl font-black text-gray-900">₹{Number(quotedPrice).toLocaleString()}</span>
                    <span className="text-xs text-blue-600/70 block mt-1.5">Based on default BOQ</span>
                  </div>
                  
                  <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50/30 p-6 rounded-2xl border border-orange-100 shadow-sm">
                    <span className="block text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">Customer Target Price</span>
                    <span className="text-3xl font-black text-gray-900">₹{Number(targetPrice).toLocaleString()}</span>
                    <span className="text-xs text-orange-600/70 block mt-1.5">Stated limit</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[var(--color-border)] pt-6">
                  <div className="p-4 rounded-xl bg-gray-50/50 border border-[var(--color-border)]">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">The Gap</span>
                    <span className={`text-xl font-extrabold ${gap > 0 ? 'text-red-650' : gap < 0 ? 'text-emerald-650' : 'text-gray-900'}`}>
                      {gap > 0 ? `₹${gap.toLocaleString()}` : gap < 0 ? `₹${Math.abs(gap).toLocaleString()} Above` : 'Aligned'}
                    </span>
                    {gap > 0 && <span className="block text-[10px] text-red-500 mt-0.5">{discountPercent}% difference</span>}
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50/50 border border-[var(--color-border)]">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Tactical Discount</span>
                    <span className="text-xl font-extrabold text-gray-800">
                      {gap > 0 ? `${discountPercent}%` : '0%'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50/50 border border-[var(--color-border)]">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Status</span>
                    <span className={`text-xl font-extrabold flex items-center gap-1 ${gap <= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {gap <= 0 ? '🟢 Viable' : '🟡 In Review'}
                    </span>
                  </div>
                </div>

                {notes && (
                  <div className="bg-gray-50 p-5 rounded-2xl border border-[var(--color-border)] shadow-inner">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Negotiation Tactics & Logged Notes</span>
                    <p className="text-sm text-gray-700 leading-relaxed italic">"{notes}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Negotiation Companion */}
        <div className="space-y-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-4 mb-4 relative z-10">
              <span className="text-xl p-1 bg-indigo-50 text-indigo-600 rounded-lg">🤖</span>
              <div>
                <h4 className="font-bold text-sm tracking-wide uppercase text-[var(--color-text-h)]">AI Closing Companion</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {productScopes.length > 0 ? `${productScopes.map(s => s.replace(/^\w/, c => c.toUpperCase())).join(', ')} focused insights.` : 'Advice based on pricing gaps.'}
                </p>
              </div>
            </div>

            {gap > 0 ? (
              <div className="space-y-4 relative z-10">
                <div className="p-3 bg-gray-50 rounded-xl text-xs flex justify-between items-center border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)] font-medium">Price gap to resolve</span>
                  <span className="font-bold text-orange-600">₹{gap.toLocaleString()}</span>
                </div>

                {/* Tactical tabs */}
                <div className="flex bg-gray-150 p-1 rounded-lg border border-[var(--color-border)]">
                  {['all', 'add-ons', 'scope'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTacticTab(tab)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                        activeTacticTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 mt-2 min-h-[140px] max-h-[350px] overflow-y-auto custom-scrollbar">
                  {filteredRecommendations.map((tactic, idx) => (
                    <div key={idx} className="p-3.5 bg-white rounded-xl border border-blue-100 text-xs leading-relaxed shadow-sm animate-fadeIn">
                      <strong className="text-blue-700 block mb-1">{tactic.title}</strong>
                      <p className="text-gray-700">{tactic.text}</p>
                    </div>
                  ))}
                  {filteredRecommendations.length === 0 && (
                    <p className="text-center text-xs text-gray-400 italic py-6">No specific recommendations found for this filter.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 relative z-10">
                <span className="text-4xl block mb-2">🎉</span>
                <p className="text-sm font-bold text-green-700">Budget fully aligned!</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-[200px] mx-auto">
                  The client target matches or exceeds your quoted price. Proceed to project conversion.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
