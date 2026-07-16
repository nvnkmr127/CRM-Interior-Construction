/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, Statistic, Row, Col, Spin, Alert } from 'antd';
import { getProjectProfitability, getProjectLedger } from '../../api/projects';
import { formatCurrency } from '../../utils/formatters';
import moment from 'moment';

const { Title, Text } = Typography;

const ProjectProfitability = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [profitability, setProfitability] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profitData, ledgerData] = await Promise.all([
        getProjectProfitability(projectId),
        getProjectLedger(projectId)
      ]);
      setProfitability(profitData);
      setLedger(ledgerData || []);
    } catch (err) {
      console.error('Error fetching profitability data:', err);
      setError('Failed to load profitability metrics.');
    } finally {
      setLoading(false);
    }
  };

  const getMarginColor = (marginPercent) => {
    if (marginPercent >= 20) return '#3f8600';
    if (marginPercent >= 10) return '#faad14';
    return '#cf1322';
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'incurred_date',
      key: 'incurred_date',
      render: (date) => moment(date).format('DD MMM YYYY')
    },
    {
      title: 'Category',
      dataIndex: 'cost_category',
      key: 'cost_category',
      render: (cat) => <Tag color="blue">{cat?.toUpperCase()}</Tag>
    },
    {
      title: 'Source Type',
      dataIndex: 'source_type',
      key: 'source_type',
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amt) => <Text type="danger">{formatCurrency(amt)}</Text>,
      align: 'right'
    }
  ];

  if (loading) return <Spin size="large" className="w-full flex justify-center py-10" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!profitability) return <Alert message="No Data" description="Profitability data not available." type="info" showIcon />;

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Revenue" value={formatCurrency(profitability.revenue)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Cost" value={formatCurrency(profitability.total_cost)} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Gross Margin" 
              value={formatCurrency(profitability.gross_margin)} 
              valueStyle={{ color: getMarginColor(profitability.gross_margin_percentage) }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Margin %" 
              value={`${profitability.gross_margin_percentage}%`} 
              valueStyle={{ color: getMarginColor(profitability.gross_margin_percentage) }} 
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card size="small" title="Material Cost">
            <Text>{formatCurrency(profitability.total_material_cost)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" title="Labour Cost">
            <Text>{formatCurrency(profitability.total_labour_cost)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" title="Vendor Cost">
            <Text>{formatCurrency(profitability.total_vendor_cost)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" title="Overhead Cost">
            <Text>{formatCurrency(profitability.total_overhead_cost)}</Text>
          </Card>
        </Col>
      </Row>

      <Card title="Project Cost Ledger" className="mt-4">
        <Table 
          columns={columns} 
          dataSource={ledger} 
          rowKey="source_id"
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default ProjectProfitability;
