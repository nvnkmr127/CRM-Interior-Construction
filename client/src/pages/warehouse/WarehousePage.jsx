import { useState, useEffect } from 'react';
import { getWarehouses, createWarehouse, getWarehouseInventory, getWarehouseQuarantined, getWarehouseTransactions, receiveMaterial, dispatchToSite, returnFromSite, quarantineMaterial, releaseFromQuarantine } from '../../api/warehouse';
import { getProjects } from '../../api/projects';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import styles from './WarehousePage.module.css';
import { useToast } from '../../store/toastContext';

export default function WarehousePage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory'); // inventory, quarantined, transactions
  const [projects, setProjects] = useState([]);

  // Data States
  const [inventory, setInventory] = useState([]);
  const [quarantined, setQuarantined] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [selectedItem, setSelectedItem] = useState(null);

  const [receiveForm, setReceiveForm] = useState({
    itemName: '',
    materialSpecifications: '',
    brand: '',
    quantity: '',
    unit: 'Nos',
    projectId: '',
    binLocation: '',
    notes: ''
  });

  const [dispatchForm, setDispatchForm] = useState({
    projectId: '',
    quantity: '',
    notes: ''
  });

  const [returnForm, setReturnForm] = useState({
    projectId: '',
    itemName: '',
    materialSpecifications: '',
    brand: '',
    quantity: '',
    unit: 'Nos',
    binLocation: '',
    notes: ''
  });

  const [quarantineForm, setQuarantineForm] = useState({
    quantity: '',
    reason: 'Transit Damage',
    notes: ''
  });

  const [releaseForm, setReleaseForm] = useState({
    quantity: '',
    notes: ''
  });

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      loadTabData();
    }
  }, [selectedWarehouse, activeTab]);

  async function loadBaseData() {
    setLoading(true);
    try {
      const [wRes, pRes] = await Promise.all([
        getWarehouses(),
        getProjects()
      ]);
      const wList = wRes.data?.data || wRes.data || [];
      setWarehouses(wList);
      
      const pList = pRes.data?.data || pRes.data || [];
      setProjects(pList.filter(p => p.status === 'active'));

      if (wList.length > 0) {
        setSelectedWarehouse(wList[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load initial data.');
    } finally {
      setLoading(false);
    }
  };

  async function loadTabData() {
    if (!selectedWarehouse) return;
    try {
      if (activeTab === 'inventory') {
        const res = await getWarehouseInventory(selectedWarehouse.id);
        setInventory(res.data?.data || res.data || []);
      } else if (activeTab === 'quarantined') {
        const res = await getWarehouseQuarantined(selectedWarehouse.id);
        setQuarantined(res.data?.data || res.data || []);
      } else {
        const res = await getWarehouseTransactions(selectedWarehouse.id);
        setTransactions(res.data?.data || res.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tab contents.');
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!warehouseForm.name) return toast.error('Warehouse name is required.');
    setActionLoading(true);
    try {
      const res = await createWarehouse(warehouseForm);
      if (res.data?.success || res.status === 201) {
        const newW = res.data?.data || res.data;
        setWarehouses([...warehouses, newW]);
        setSelectedWarehouse(newW);
        setIsWarehouseModalOpen(false);
        setWarehouseForm({ name: '', location: '' });
        toast.success('Warehouse created successfully.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to create warehouse.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    const { itemName, quantity, unit } = receiveForm;
    if (!itemName || !quantity || !unit) return toast.error('Required fields are missing.');

    setActionLoading(true);
    try {
      await receiveMaterial(selectedWarehouse.id, receiveForm);
      toast.success('Material received and inventory updated.');
      setIsReceiveModalOpen(false);
      setReceiveForm({
        itemName: '',
        materialSpecifications: '',
        brand: '',
        quantity: '',
        unit: 'Nos',
        projectId: '',
        binLocation: '',
        notes: ''
      });
      loadTabData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to receive material.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatchStock = async (e) => {
    e.preventDefault();
    const { projectId, quantity } = dispatchForm;
    if (!projectId || !quantity) return toast.error('Required fields are missing.');

    setActionLoading(true);
    try {
      await dispatchToSite(selectedWarehouse.id, {
        itemId: selectedItem.id,
        projectId,
        quantity: Number(quantity),
        notes: dispatchForm.notes
      });
      toast.success('Stock dispatched to project site.');
      setIsDispatchModalOpen(false);
      setDispatchForm({ projectId: '', quantity: '', notes: '' });
      loadTabData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to dispatch stock.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnStock = async (e) => {
    e.preventDefault();
    const { projectId, itemName, quantity, unit } = returnForm;
    if (!projectId || !itemName || !quantity || !unit) return toast.error('Required fields are missing.');

    setActionLoading(true);
    try {
      await returnFromSite(selectedWarehouse.id, returnForm);
      toast.success('Return logged. Stock returned back to inventory.');
      setIsReturnModalOpen(false);
      setReturnForm({
        projectId: '',
        itemName: '',
        materialSpecifications: '',
        brand: '',
        quantity: '',
        unit: 'Nos',
        binLocation: '',
        notes: ''
      });
      loadTabData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to return stock.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuarantineStock = async (e) => {
    e.preventDefault();
    const { quantity, reason } = quarantineForm;
    if (!quantity || !reason) return toast.error('Required fields are missing.');

    setActionLoading(true);
    try {
      await quarantineMaterial(selectedWarehouse.id, {
        itemId: selectedItem.id,
        quantity: Number(quantity),
        reason,
        notes: quarantineForm.notes
      });
      toast.success('Material moved to quarantined stock.');
      setIsQuarantineModalOpen(false);
      setQuarantineForm({ quantity: '', reason: 'Transit Damage', notes: '' });
      loadTabData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to quarantine stock.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseStock = async (e) => {
    e.preventDefault();
    const { quantity } = releaseForm;
    if (!quantity) return toast.error('Quantity is required.');

    setActionLoading(true);
    try {
      await releaseFromQuarantine(selectedWarehouse.id, {
        quarantinedItemId: selectedItem.id,
        quantity: Number(quantity),
        notes: releaseForm.notes
      });
      toast.success('Material released back to active stock.');
      setIsReleaseModalOpen(false);
      setReleaseForm({ quantity: '', notes: '' });
      loadTabData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to release material.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filters
  const filteredInventory = inventory.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      (item.project_name && item.project_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className={styles.container}>
      {/* Left panel: Warehouses */}
      <div className={styles.leftPane}>
        <div className={styles.paneHeader}>
          <h3>Warehouses</h3>
          <Button size="small" onClick={() => setIsWarehouseModalOpen(true)}>+</Button>
        </div>
        <div className={styles.warehouseList}>
          {warehouses.map((w, index) => (
            <div
              key={w.id || index}
              className={`${styles.warehouseItem} ${selectedWarehouse?.id === w.id ? styles.activeWarehouse : ''}`}
              onClick={() => setSelectedWarehouse(w)}
            >
              <strong>{w.name}</strong>
              <span>{w.location || 'No location address'}</span>
            </div>
          ))}
          {warehouses.length === 0 && !loading && (
            <div className={styles.emptyState}>No warehouses created.</div>
          )}
        </div>
      </div>

      {/* Right panel: Tabbed Inventory Details */}
      <div className={styles.rightPane}>
        {selectedWarehouse ? (
          <>
            <div className={styles.warehouseHeader}>
              <div>
                <h2>{selectedWarehouse.name}</h2>
                <p className={styles.locationText}>{selectedWarehouse.location || 'No address location specified'}</p>
              </div>
              <div className={styles.headerActions}>
                <Button variant="secondary" onClick={() => setIsReturnModalOpen(true)}>Return from Site</Button>
                <Button onClick={() => setIsReceiveModalOpen(true)}>Receive Material</Button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className={styles.tabNav}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'inventory' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                Stock Inventory
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'quarantined' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('quarantined')}
              >
                Quarantined Inventory
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'transactions' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('transactions')}
              >
                Transaction History
              </button>
            </div>

            <div className={styles.tabContent}>
              {/* Tab: Stock Inventory */}
              {activeTab === 'inventory' && (
                <div>
                  <div className={styles.searchBar}>
                    <input
                      type="text"
                      placeholder="Search inventory by name, brand, or project..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Material Description</th>
                        <th>Brand</th>
                        <th>Project Reservation</th>
                        <th className={styles.textRight}>Stock Qty</th>
                        <th>Bin Location</th>
                        <th className={styles.textCenter}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map(item => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.item_name}</strong>
                            {item.material_specifications && (
                              <p className={styles.specText}>{item.material_specifications}</p>
                            )}
                          </td>
                          <td>{item.brand || '—'}</td>
                          <td>
                            {item.project_name ? (
                              <span className={styles.projectTag}>{item.project_name}</span>
                            ) : (
                              <span className={styles.generalStockTag}>General Stock</span>
                            )}
                          </td>
                          <td className={styles.textRight}>
                            <strong>{Number(item.quantity)}</strong> {item.unit}
                          </td>
                          <td>{item.bin_location || '—'}</td>
                          <td className={styles.textCenter}>
                            <div className={styles.rowActions}>
                              <Button
                                size="small"
                                variant="secondary"
                                disabled={Number(item.quantity) <= 0}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDispatchModalOpen(true);
                                }}
                              >
                                Dispatch
                              </Button>
                              <Button
                                size="small"
                                variant="ghost"
                                disabled={Number(item.quantity) <= 0}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsQuarantineModalOpen(true);
                                }}
                                style={{ color: 'var(--color-danger, #ef4444)' }}
                              >
                                Quarantine
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredInventory.length === 0 && (
                        <tr>
                          <td colSpan="6" className={styles.emptyTable}>No matching stock items.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: Quarantined Inventory */}
              {activeTab === 'quarantined' && (
                <div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Material Description</th>
                        <th>Brand</th>
                        <th>Project Tag</th>
                        <th>Damage Reason</th>
                        <th className={styles.textRight}>Quarantined Qty</th>
                        <th className={styles.textCenter}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarantined.map(item => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.item_name}</strong>
                            {item.material_specifications && (
                              <p className={styles.specText}>{item.material_specifications}</p>
                            )}
                          </td>
                          <td>{item.brand || '—'}</td>
                          <td>
                            {item.project_name ? (
                              <span className={styles.projectTag}>{item.project_name}</span>
                            ) : (
                              <span className={styles.generalStockTag}>General Stock</span>
                            )}
                          </td>
                          <td>
                            <span className={styles.reasonTag}>{item.reason}</span>
                          </td>
                          <td className={styles.textRight}>
                            <strong>{Number(item.quantity)}</strong> {item.unit}
                          </td>
                          <td className={styles.textCenter}>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => {
                                setSelectedItem(item);
                                setIsReleaseModalOpen(true);
                              }}
                            >
                              Release
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {quarantined.length === 0 && (
                        <tr>
                          <td colSpan="6" className={styles.emptyTable}>No quarantined materials.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: Transaction History */}
              {activeTab === 'transactions' && (
                <div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Item Details</th>
                        <th className={styles.textRight}>Quantity</th>
                        <th>Project Link</th>
                        <th>Notes & Audits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id}>
                          <td>{new Date(tx.created_at).toLocaleString('en-IN')}</td>
                          <td>
                            <span className={`${styles.txTypeTag} ${styles[tx.transaction_type]}`}>
                              {tx.transaction_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <strong>{tx.item_name}</strong>
                            {tx.brand && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}> [{tx.brand}]</span>}
                          </td>
                          <td className={styles.textRight}>
                            {Number(tx.quantity)} {tx.unit}
                          </td>
                          <td>{tx.project_name || '—'}</td>
                          <td>
                            <p style={{ margin: 0, fontSize: '12px' }}>{tx.notes}</p>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              Logged by: {tx.created_by_name || 'System'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan="6" className={styles.emptyTable}>No transaction records.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.noWarehouseSelected}>
            <p>Select or create a warehouse from the left menu to start managing stock inventory.</p>
            <Button onClick={() => setIsWarehouseModalOpen(true)}>Add Warehouse</Button>
          </div>
        )}
      </div>

      {/* MODAL: Create Warehouse */}
      <Modal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        title="Add Warehouse"
      >
        <form onSubmit={handleCreateWarehouse}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <label>Warehouse Name *</label>
              <input
                type="text"
                required
                value={warehouseForm.name}
                onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                placeholder="e.g. Central Bangalore Warehouse"
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Location Address</label>
              <input
                type="text"
                value={warehouseForm.location}
                onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                placeholder="e.g. Indiranagar, Bangalore"
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsWarehouseModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>Create Warehouse</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Receive Material */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Receive Material"
      >
        <form onSubmit={handleReceiveStock}>
          <div className={styles.formGrid}>
            <div>
              <label>Material Name *</label>
              <input
                type="text"
                required
                value={receiveForm.itemName}
                onChange={e => setReceiveForm({ ...receiveForm, itemName: e.target.value })}
                placeholder="e.g. Teak Plywood"
              />
            </div>
            <div>
              <label>Brand</label>
              <input
                type="text"
                value={receiveForm.brand}
                onChange={e => setReceiveForm({ ...receiveForm, brand: e.target.value })}
                placeholder="e.g. Greenply"
              />
            </div>
            <div>
              <label>Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={receiveForm.quantity}
                onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                placeholder="e.g. 50"
              />
            </div>
            <div>
              <label>Unit *</label>
              <input
                type="text"
                required
                value={receiveForm.unit}
                onChange={e => setReceiveForm({ ...receiveForm, unit: e.target.value })}
                placeholder="e.g. Nos, Sqft"
              />
            </div>
            <div>
              <label>Project Tagging (Reserve stock)</label>
              <select
                value={receiveForm.projectId}
                onChange={e => setReceiveForm({ ...receiveForm, projectId: e.target.value })}
              >
                <option value="">General Stock (Unreserved)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Bin Location</label>
              <input
                type="text"
                value={receiveForm.binLocation}
                onChange={e => setReceiveForm({ ...receiveForm, binLocation: e.target.value })}
                placeholder="e.g. Aisle 3 - Shelf B"
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Specifications</label>
              <textarea
                value={receiveForm.materialSpecifications}
                onChange={e => setReceiveForm({ ...receiveForm, materialSpecifications: e.target.value })}
                placeholder="Thickness, grade, finish details..."
                rows={2}
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Receipt Notes</label>
              <textarea
                value={receiveForm.notes}
                onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                placeholder="Supplier name, delivery challan number, etc..."
                rows={2}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsReceiveModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>Log Receipt</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Dispatch to Site */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title={`Dispatch ${selectedItem?.item_name}`}
      >
        <form onSubmit={handleDispatchStock}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <p>
                <strong>Available Stock:</strong> {selectedItem?.quantity} {selectedItem?.unit}
              </p>
            </div>
            <div className={styles.fullWidth}>
              <label>Destination Project *</label>
              <select
                required
                value={dispatchForm.projectId}
                onChange={e => setDispatchForm({ ...dispatchForm, projectId: e.target.value })}
              >
                <option value="">Select Site Project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fullWidth}>
              <label>Dispatch Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={dispatchForm.quantity}
                onChange={e => setDispatchForm({ ...dispatchForm, quantity: e.target.value })}
                max={selectedItem?.quantity}
                placeholder={`Max: ${selectedItem?.quantity}`}
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Dispatch Notes / Gate Pass Info</label>
              <textarea
                value={dispatchForm.notes}
                onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                placeholder="Driver detail, vehicle number, gate pass barcode..."
                rows={2}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsDispatchModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>Issue Gate Pass</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Return from Site */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Return Unused Material from Site"
      >
        <form onSubmit={handleReturnStock}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <label>Source Project *</label>
              <select
                required
                value={returnForm.projectId}
                onChange={e => setReturnForm({ ...returnForm, projectId: e.target.value })}
              >
                <option value="">Select Project Site...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Material Name *</label>
              <input
                type="text"
                required
                value={returnForm.itemName}
                onChange={e => setReturnForm({ ...returnForm, itemName: e.target.value })}
                placeholder="e.g. Teak Plywood"
              />
            </div>
            <div>
              <label>Brand</label>
              <input
                type="text"
                value={returnForm.brand}
                onChange={e => setReturnForm({ ...returnForm, brand: e.target.value })}
                placeholder="e.g. Greenply"
              />
            </div>
            <div>
              <label>Return Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={returnForm.quantity}
                onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label>Unit *</label>
              <input
                type="text"
                required
                value={returnForm.unit}
                onChange={e => setReturnForm({ ...returnForm, unit: e.target.value })}
                placeholder="e.g. Nos, Sqft"
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Bin Location in Warehouse</label>
              <input
                type="text"
                value={returnForm.binLocation}
                onChange={e => setReturnForm({ ...returnForm, binLocation: e.target.value })}
                placeholder="e.g. Aisle 3 - Shelf B"
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Specifications</label>
              <textarea
                value={returnForm.materialSpecifications}
                onChange={e => setReturnForm({ ...returnForm, materialSpecifications: e.target.value })}
                placeholder="Thickness, grade, finish details..."
                rows={2}
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Return Reason & Inspection Notes</label>
              <textarea
                value={returnForm.notes}
                onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })}
                placeholder="Excess supply returned, minor scratches but fully reusable..."
                rows={2}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsReturnModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>Log Site Return</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Quarantine Material */}
      <Modal
        isOpen={isQuarantineModalOpen}
        onClose={() => setIsQuarantineModalOpen(false)}
        title={`Quarantine ${selectedItem?.item_name}`}
      >
        <form onSubmit={handleQuarantineStock}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <p>
                <strong>Available Stock:</strong> {selectedItem?.quantity} {selectedItem?.unit}
              </p>
            </div>
            <div className={styles.fullWidth}>
              <label>Quarantine Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={quarantineForm.quantity}
                onChange={e => setQuarantineForm({ ...quarantineForm, quantity: e.target.value })}
                max={selectedItem?.quantity}
                placeholder={`Max: ${selectedItem?.quantity}`}
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Damage/Issue Reason *</label>
              <select
                required
                value={quarantineForm.reason}
                onChange={e => setQuarantineForm({ ...quarantineForm, reason: e.target.value })}
              >
                <option value="Transit Damage">Transit Damage (Logistics)</option>
                <option value="Site Damage">Site Damage (Handling)</option>
                <option value="Manufacturer Defect">Manufacturer Defect (Supplier)</option>
                <option value="Water/Moisture Damage">Water/Moisture Damage (Storage)</option>
                <option value="Other">Other / Review Pending</option>
              </select>
            </div>
            <div className={styles.fullWidth}>
              <label>Audit Notes</label>
              <textarea
                value={quarantineForm.notes}
                onChange={e => setQuarantineForm({ ...quarantineForm, notes: e.target.value })}
                placeholder="Specify exact damage descriptions..."
                rows={2}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsQuarantineModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading} style={{ background: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}>
                Move to Quarantine
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Release from Quarantine */}
      <Modal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        title={`Release ${selectedItem?.item_name}`}
      >
        <form onSubmit={handleReleaseStock}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <p>
                <strong>Quarantined Qty:</strong> {selectedItem?.quantity} {selectedItem?.unit}
              </p>
            </div>
            <div className={styles.fullWidth}>
              <label>Release Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={releaseForm.quantity}
                onChange={e => setReleaseForm({ ...releaseForm, quantity: e.target.value })}
                max={selectedItem?.quantity}
                placeholder={`Max: ${selectedItem?.quantity}`}
              />
            </div>
            <div className={styles.fullWidth}>
              <label>Inspection Notes (Un-quarantine rationale)</label>
              <textarea
                value={releaseForm.notes}
                onChange={e => setReleaseForm({ ...releaseForm, notes: e.target.value })}
                placeholder="Polished / repaired on site, passed QC inspection..."
                rows={2}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setIsReleaseModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionLoading}>Release to Active Stock</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
