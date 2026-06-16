import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function LeadCaptureForm() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    locality: '',
    property_type: '',
    carpet_area_sqft: '',
    num_rooms: '',
    possession_date: '',
    scope: '',
    budget_min: 50000,
    budget_max: 5000000,
    source: 'website',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: ''
  });

  useEffect(() => {
    // Parse UTM parameters from URL
    const params = new URLSearchParams(window.location.search);
    setFormData(prev => ({
      ...prev,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
      source: params.get('utm_source') || 'website'
    }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.name) return 'Name is required';
      if (!formData.phone || !/^\d{10}$/.test(formData.phone)) return 'Phone must be exactly 10 digits';
      if (!formData.city) return 'City is required';
      if (!formData.locality) return 'Locality is required';
    } else if (step === 2) {
      if (!formData.property_type) return 'Property type is required';
      if (!formData.carpet_area_sqft) return 'Carpet area is required';
      if (!formData.num_rooms) return 'Number of rooms is required';
      if (!formData.possession_date) return 'Possession date is required';
      
      const pDate = new Date(formData.possession_date);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (pDate < today) return 'Possession date must be in the future';
    } else if (step === 3) {
      if (!formData.scope) return 'Scope is required';
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/leads/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to submit');
      }
      
      setSuccessData(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successData) {
    const repName = successData.rep?.name || 'our team';
    return (
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-green-600">Thank You!</CardTitle>
          <CardDescription>Your inquiry has been received.</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>We're excited to help you design your dream space.</p>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm text-gray-500 mb-2">Your dedicated representative</p>
            {successData.rep?.photo ? (
              <img src={successData.rep.photo} alt={repName} className="w-16 h-16 rounded-full mx-auto mb-2" />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold text-gray-400">
                {repName.charAt(0)}
              </div>
            )}
            <h4 className="font-semibold">{repName}</h4>
            <p className="text-sm">will be in touch with you shortly.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Get Your Free Estimate</CardTitle>
        <CardDescription>Step {step} of 3</CardDescription>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 3) * 100}%` }} 
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {error && <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
        
        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
          
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" name="phone" type="tel" maxLength="10" placeholder="10 digits" value={formData.phone} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locality">Locality *</Label>
                  <Input id="locality" name="locality" value={formData.locality} onChange={handleChange} required />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property_type">Property Type *</Label>
                <select 
                  id="property_type" 
                  name="property_type" 
                  value={formData.property_type} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="">Select type...</option>
                  <option value="flat">Flat / Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="office">Office</option>
                  <option value="retail">Retail</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carpet_area_sqft">Carpet Area (sqft) *</Label>
                  <Input id="carpet_area_sqft" name="carpet_area_sqft" type="number" value={formData.carpet_area_sqft} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_rooms">Number of Rooms *</Label>
                  <Input id="num_rooms" name="num_rooms" type="number" value={formData.num_rooms} onChange={handleChange} required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="possession_date">Expected Possession Date *</Label>
                <Input id="possession_date" name="possession_date" type="date" value={formData.possession_date} onChange={handleChange} required />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scope">Scope of Work *</Label>
                <select 
                  id="scope" 
                  name="scope" 
                  value={formData.scope} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="">Select scope...</option>
                  <option value="full_home">Full Home Interiors</option>
                  <option value="modular_kitchen">Modular Kitchen</option>
                  <option value="wardrobe">Wardrobes</option>
                  <option value="partial">Partial Renovation</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_max">Budget Range (Max: ₹{Number(formData.budget_max).toLocaleString()})</Label>
                <input 
                  type="range" 
                  id="budget_max" 
                  name="budget_max" 
                  min="50000" 
                  max="5000000" 
                  step="50000"
                  value={formData.budget_max} 
                  onChange={handleChange}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>₹50K</span>
                  <span>₹50L+</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">How did you hear about us?</Label>
                <Input id="source" name="source" value={formData.source} onChange={handleChange} placeholder="e.g. Google, Friend, Instagram" />
              </div>
            </div>
          )}
        </form>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t p-4">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={prevStep} disabled={isSubmitting}>
            Back
          </Button>
        ) : <div />}
        
        {step < 3 ? (
          <Button type="button" onClick={nextStep}>
            Next Step
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
