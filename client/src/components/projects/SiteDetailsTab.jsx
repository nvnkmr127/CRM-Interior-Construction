import React, { useState } from 'react';
import { Button, Input, Modal, Select } from '../ui';
import { updateProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function SiteDetailsTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  const openEdit = () => {
    setFormData({
      siteAddress: project.site_address || '',
      flatNumber: project.flat_number || '',
      floor: project.floor || '',
      buildingName: project.building_name || '',
      street: project.street || '',
      landmark: project.landmark || '',
      city: project.city || '',
      pincode: project.pincode || '',
      latitude: project.latitude || '',
      longitude: project.longitude || '',
      builderName: project.builder_name || '',
      societyName: project.society_name || '',
      reraId: project.rera_id || '',
      nocStatus: project.noc_status || 'pending',
      occupancyCertificateStatus: project.occupancy_certificate_status || 'pending',
      propertyHandoverDate: project.property_handover_date ? project.property_handover_date.split('T')[0] : '',
      carpetArea: project.carpet_area || '',
      builtUpArea: project.built_up_area || '',
      numberOfRooms: project.number_of_rooms || '',
      propertyType: project.property_type || '',
      propertyAge: project.property_age || '',
      renovationScope: project.renovation_scope || '',
      segment: project.segment || '',

      liftAvailability: project.lift_availability || '',
      liftDimensions: project.lift_dimensions || '',
      staircaseAccess: project.staircase_access || '',
      workingHourWindow: project.working_hour_window || '',
      societyContact: project.society_contact || '',
      parkingPermission: project.parking_permission || '',
      unloadingArea: project.unloading_area || '',
      nocRequirements: project.noc_requirements || '',
      keyHolderName: project.key_holder_name || '',
      keyHolderPhone: project.key_holder_phone || '',
      spareKeyLocation: project.spare_key_location || '',
      gatePassNumber: project.gate_pass_number || '',
      accessCardHolder: project.access_card_holder || '',
      accessTimeRestrictions: project.access_time_restrictions || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        site_address: formData.siteAddress || null,
        flat_number: formData.flatNumber || null,
        floor: formData.floor || null,
        building_name: formData.buildingName || null,
        street: formData.street || null,
        landmark: formData.landmark || null,
        city: formData.city || null,
        pincode: formData.pincode || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        builder_name: formData.builderName || null,
        society_name: formData.societyName || null,
        rera_id: formData.reraId || null,
        noc_status: formData.nocStatus || null,
        occupancy_certificate_status: formData.occupancyCertificateStatus || null,
        property_handover_date: formData.propertyHandoverDate || null,
        carpet_area: formData.carpetArea ? Number(formData.carpetArea) : null,
        built_up_area: formData.builtUpArea ? Number(formData.builtUpArea) : null,
        number_of_rooms: formData.numberOfRooms ? Number(formData.numberOfRooms) : null,
        property_type: formData.propertyType || null,
        property_age: formData.propertyAge || null,
        renovation_scope: formData.renovationScope || null,
        segment: formData.segment || null,

        lift_availability: formData.liftAvailability || null,
        lift_dimensions: formData.liftDimensions || null,
        staircase_access: formData.staircaseAccess || null,
        working_hour_window: formData.workingHourWindow || null,
        society_contact: formData.societyContact || null,
        parking_permission: formData.parkingPermission || null,
        unloading_area: formData.unloadingArea || null,
        noc_requirements: formData.nocRequirements || null,
        key_holder_name: formData.keyHolderName || null,
        key_holder_phone: formData.keyHolderPhone || null,
        spare_key_location: formData.spareKeyLocation || null,
        gate_pass_number: formData.gatePassNumber || null,
        access_card_holder: formData.accessCardHolder || null,
        access_time_restrictions: formData.accessTimeRestrictions || null,
      };
      await updateProject(project.id, payload);
      toast.success('Site Details updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update site details');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: 'Site Address', value: project.site_address || '—' },
    { label: 'Flat / Unit No', value: project.flat_number || '—' },
    { label: 'Floor', value: project.floor || '—' },
    { label: 'Building Name', value: project.building_name || '—' },
    { label: 'Street', value: project.street || '—' },
    { label: 'Landmark', value: project.landmark || '—' },
    { label: 'City', value: project.city || '—' },
    { label: 'Pincode', value: project.pincode || '—' },
    { label: 'GPS Coordinates', value: project.latitude && project.longitude ? `${project.latitude}, ${project.longitude}` : '—' },
    { label: 'Builder Name', value: project.builder_name || '—' },
    { label: 'Society Name', value: project.society_name || '—' },
    { label: 'RERA ID', value: project.rera_id || '—' },
    { label: 'Builder NOC', value: project.noc_status ? project.noc_status.replace(/_/g, ' ') : '—' },
    { label: 'Occupancy Cert.', value: project.occupancy_certificate_status ? project.occupancy_certificate_status.replace(/_/g, ' ') : '—' },
    { label: 'Property Handover Date', value: project.property_handover_date ? new Date(project.property_handover_date).toLocaleDateString('en-IN') : '—' },
    { label: 'Carpet Area', value: project.carpet_area ? `${project.carpet_area} sq ft` : '—' },
    { label: 'Built-up Area', value: project.built_up_area ? `${project.built_up_area} sq ft` : '—' },
    { label: 'Number of Rooms', value: project.number_of_rooms || '—' },
    { label: 'Ownership Type', value: project.property_type ? project.property_type.replace(/_/g, ' ') : '—' },
    { label: 'Property Age', value: project.property_age ? project.property_age.replace(/_/g, ' ') : '—' },
    { label: 'Renovation Scope', value: project.renovation_scope ? project.renovation_scope.replace(/_/g, ' ') : '—' },
    { label: 'Market Segment', value: project.segment ? project.segment.replace(/_/g, ' ') : '—' },

    { label: 'Lift Availability', value: project.lift_availability || '—' },
    { label: 'Lift Dimensions', value: project.lift_dimensions || '—' },
    { label: 'Staircase Access', value: project.staircase_access || '—' },
    { label: 'Working Hour Window', value: project.working_hour_window || '—' },
    { label: 'Society Contact', value: project.society_contact || '—' },
    { label: 'Parking Permission', value: project.parking_permission || '—' },
    { label: 'Unloading Area', value: project.unloading_area || '—' },
    { label: 'NOC Requirements', value: project.noc_requirements || '—' },
    { label: 'Key Holder Name', value: project.key_holder_name || '—' },
    { label: 'Key Holder Phone', value: project.key_holder_phone || '—' },
    { label: 'Spare Key Location', value: project.spare_key_location || '—' },
    { label: 'Gate Pass Number', value: project.gate_pass_number || '—' },
    { label: 'Access Card Holder', value: project.access_card_holder || '—' },
    { label: 'Access Time Restrictions', value: project.access_time_restrictions || '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Site Details & Permissions
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}>
            ✏️ Edit
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: i < fields.length - (fields.length % 2 === 0 ? 2 : 1) ? '1px solid var(--color-border)' : 'none',
              borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Site Details" size="lg">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '16px' }}>
          <Input label="Site Address" value={formData.siteAddress} onChange={e => setFormData({...formData, siteAddress: e.target.value})} />
          <Input label="Flat / Unit No" value={formData.flatNumber} onChange={e => setFormData({...formData, flatNumber: e.target.value})} />
          <Input label="Floor" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} />
          <Input label="Building Name" value={formData.buildingName} onChange={e => setFormData({...formData, buildingName: e.target.value})} />
          <Input label="Street" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
          <Input label="Landmark" value={formData.landmark} onChange={e => setFormData({...formData, landmark: e.target.value})} />
          <Input label="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
          <Input label="Pincode" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
          <Input label="Latitude" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
          <Input label="Longitude" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
          <Input label="Builder Name" value={formData.builderName} onChange={e => setFormData({...formData, builderName: e.target.value})} />
          <Input label="Society Name" value={formData.societyName} onChange={e => setFormData({...formData, societyName: e.target.value})} />
          <Input label="RERA ID" value={formData.reraId} onChange={e => setFormData({...formData, reraId: e.target.value})} />
          <Select label="Builder NOC" options={[{value: 'pending', label: 'Pending'}, {value: 'approved', label: 'Approved'}, {value: 'not_required', label: 'Not Required'}]} value={formData.nocStatus} onChange={v => setFormData({...formData, nocStatus: v})} />
          <Select label="Occupancy Cert." options={[{value: 'pending', label: 'Pending'}, {value: 'received', label: 'Received'}, {value: 'not_applicable', label: 'Not Applicable'}]} value={formData.occupancyCertificateStatus} onChange={v => setFormData({...formData, occupancyCertificateStatus: v})} />
          <Input type="date" label="Property Handover Date" value={formData.propertyHandoverDate} onChange={e => setFormData({...formData, propertyHandoverDate: e.target.value})} />
          <Input type="number" label="Carpet Area (sq ft)" value={formData.carpetArea} onChange={e => setFormData({...formData, carpetArea: e.target.value})} />
          <Input type="number" label="Built-up Area (sq ft)" value={formData.builtUpArea} onChange={e => setFormData({...formData, builtUpArea: e.target.value})} />
          <Input type="number" label="Number of Rooms" value={formData.numberOfRooms} onChange={e => setFormData({...formData, numberOfRooms: e.target.value})} />
          <Input label="Ownership Type" value={formData.propertyType} onChange={e => setFormData({...formData, propertyType: e.target.value})} />
          <Input label="Property Age" value={formData.propertyAge} onChange={e => setFormData({...formData, propertyAge: e.target.value})} />
          <Input label="Renovation Scope" value={formData.renovationScope} onChange={e => setFormData({...formData, renovationScope: e.target.value})} />
          <Input label="Market Segment" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value})} />

          <Select 
            label="Lift Availability" 
            options={[{value: '', label: 'Select'}, {value: 'Yes', label: 'Yes'}, {value: 'No', label: 'No'}, {value: 'Service Lift Only', label: 'Service Lift Only'}]}
            value={formData.liftAvailability}
            onChange={v => setFormData({...formData, liftAvailability: v})}
          />
          <Input 
            label="Lift Dimensions (W x H x D)" 
            placeholder="e.g. 5x5x7 ft"
            value={formData.liftDimensions}
            onChange={e => setFormData({...formData, liftDimensions: e.target.value})}
          />
          <Input 
            label="Staircase Access" 
            placeholder="e.g. Adequate for large boards"
            value={formData.staircaseAccess}
            onChange={e => setFormData({...formData, staircaseAccess: e.target.value})}
          />
          <Input 
            label="Working Hour Window" 
            placeholder="e.g. 9 AM to 6 PM (No Sundays)"
            value={formData.workingHourWindow}
            onChange={e => setFormData({...formData, workingHourWindow: e.target.value})}
          />
          <Input 
            label="Society Contact / Manager" 
            placeholder="Name & Phone"
            value={formData.societyContact}
            onChange={e => setFormData({...formData, societyContact: e.target.value})}
          />
          <Select 
            label="Parking Permission" 
            options={[{value: '', label: 'Select'}, {value: 'Allowed', label: 'Allowed'}, {value: 'Restricted', label: 'Restricted'}, {value: 'Paid Only', label: 'Paid Only'}]}
            value={formData.parkingPermission}
            onChange={v => setFormData({...formData, parkingPermission: v})}
          />
          <Input 
            label="Unloading Area" 
            placeholder="e.g. Basement 2, Pillar B14"
            value={formData.unloadingArea}
            onChange={e => setFormData({...formData, unloadingArea: e.target.value})}
          />
          <Input 
            label="NOC Requirements" 
            placeholder="e.g. Form 4 from Builder"
            value={formData.nocRequirements}
            onChange={e => setFormData({...formData, nocRequirements: e.target.value})}
          />
          <Input 
            label="Key Holder Name" 
            value={formData.keyHolderName}
            onChange={e => setFormData({...formData, keyHolderName: e.target.value})}
          />
          <Input 
            label="Key Holder Phone" 
            value={formData.keyHolderPhone}
            onChange={e => setFormData({...formData, keyHolderPhone: e.target.value})}
          />
          <Input 
            label="Spare Key Location" 
            placeholder="e.g. Site Supervisor"
            value={formData.spareKeyLocation}
            onChange={e => setFormData({...formData, spareKeyLocation: e.target.value})}
          />
          <Input 
            label="Gate Pass Number" 
            value={formData.gatePassNumber}
            onChange={e => setFormData({...formData, gatePassNumber: e.target.value})}
          />
          <Input 
            label="Access Card Holder" 
            value={formData.accessCardHolder}
            onChange={e => setFormData({...formData, accessCardHolder: e.target.value})}
          />
          <Input 
            label="Access Time Restrictions" 
            value={formData.accessTimeRestrictions}
            onChange={e => setFormData({...formData, accessTimeRestrictions: e.target.value})}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
