'use client'

import { useState } from 'react'
import { CharityData } from '../dummy-data'
import { formatMoney } from '@/utils/formatting'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { Card } from '@/components/layout/card'
import { clsx } from 'clsx'
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  NewspaperIcon,
  LinkIcon
} from '@heroicons/react/24/outline'

interface CharityTabsProps {
  charity: CharityData
  userId?: string
}

export function CharityTabs({ charity, userId }: CharityTabsProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'shareholders' | 'news' | 'projects'>('comments')

  const tabs = [
    { id: 'comments', label: 'Comments', icon: ChatBubbleLeftRightIcon },
    { id: 'shareholders', label: 'Shareholders', icon: UsersIcon },
    { id: 'news', label: 'News', icon: NewspaperIcon },
    { id: 'projects', label: 'Linked Projects', icon: LinkIcon }
  ] as const

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="border-b">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'comments' && <CommentsSection charity={charity} userId={userId} />}
        {activeTab === 'shareholders' && <ShareholdersSection charity={charity} />}
        {activeTab === 'news' && <NewsSection charity={charity} />}
        {activeTab === 'projects' && <ProjectsSection charity={charity} />}
      </div>
    </div>
  )
}

function CommentsSection({ charity, userId }: { charity: CharityData; userId?: string }) {
  const [newComment, setNewComment] = useState('')

  const dummyComments = [
    {
      id: '1',
      author: 'Alice Chen',
      content: `Strong fundamentals in ${charity.name}. Their recent research output has been impressive and I see good growth potential.`,
      timestamp: '2 hours ago',
      likes: 12
    },
    {
      id: '2',
      author: 'Bob Smith',
      content: 'Volume has been picking up lately. Good sign for institutional interest.',
      timestamp: '5 hours ago',
      likes: 8
    },
    {
      id: '3',
      author: 'Carol Davis',
      content: `The partnership announcements from ${charity.name} suggest they're expanding their impact reach. Bullish on this one.`,
      timestamp: '1 day ago',
      likes: 15
    }
  ]

  return (
    <Col className="gap-4">
      {userId && (
        <Card className="p-4">
          <Col className="gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this charity..."
              className="w-full p-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <Row className="justify-end">
              <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                Post Comment
              </button>
            </Row>
          </Col>
        </Card>
      )}

      <Col className="gap-3">
        {dummyComments.map((comment) => (
          <Card key={comment.id} className="p-4">
            <Col className="gap-2">
              <Row className="justify-between items-start">
                <div className="font-medium text-gray-900">{comment.author}</div>
                <div className="text-sm text-gray-500">{comment.timestamp}</div>
              </Row>
              <p className="text-gray-700">{comment.content}</p>
              <Row className="items-center gap-4 pt-2">
                <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                  <span>👍</span>
                  <span>{comment.likes}</span>
                </button>
                <button className="text-sm text-gray-500 hover:text-blue-600">
                  Reply
                </button>
              </Row>
            </Col>
          </Card>
        ))}
      </Col>
    </Col>
  )
}

function ShareholdersSection({ charity }: { charity: CharityData }) {
  return (
    <Col className="gap-4">
      <h3 className="text-lg font-medium text-gray-900">Top Shareholders</h3>
      <Col className="gap-3">
        {charity.topShareholders.map((shareholder, index) => (
          <Card key={index} className="p-4">
            <Row className="justify-between items-center">
              <Col className="gap-1">
                <div className="font-medium text-gray-900">{shareholder.name}</div>
                <div className="text-sm text-gray-500">
                  {shareholder.shares.toLocaleString()} shares
                </div>
              </Col>
              <Col className="items-end gap-1">
                <div className="text-lg font-semibold text-gray-900">
                  {shareholder.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">
                  {formatMoney(shareholder.shares * charity.currentPrice)}
                </div>
              </Col>
            </Row>
          </Card>
        ))}
      </Col>
    </Col>
  )
}

function NewsSection({ charity }: { charity: CharityData }) {
  return (
    <Col className="gap-4">
      <h3 className="text-lg font-medium text-gray-900">Recent News</h3>
      <Col className="gap-3">
        {charity.recentNews.map((news, index) => (
          <Card key={index} className="p-4">
            <Col className="gap-2">
              <Row className="justify-between items-start">
                <h4 className="font-medium text-gray-900 leading-tight">
                  {news.headline}
                </h4>
                <div className="text-sm text-gray-500">
                  {new Date(news.date).toLocaleDateString()}
                </div>
              </Row>
              <p className="text-gray-700">{news.content}</p>
            </Col>
          </Card>
        ))}
      </Col>
    </Col>
  )
}

function ProjectsSection({ charity }: { charity: CharityData }) {
  const dummyProjects = [
    {
      id: '1',
      title: `${charity.name} Research Grant 2024`,
      description: 'Funding advanced research in the organization\'s core focus area.',
      fundingGoal: 250000,
      raised: 180000,
      status: 'active'
    },
    {
      id: '2',
      title: `${charity.name} Infrastructure Expansion`,
      description: 'Building capacity for increased research output and collaboration.',
      fundingGoal: 150000,
      raised: 150000,
      status: 'completed'
    }
  ]

  return (
    <Col className="gap-4">
      <h3 className="text-lg font-medium text-gray-900">Linked Manifund Projects</h3>
      <Col className="gap-3">
        {dummyProjects.map((project) => (
          <Card key={project.id} className="p-4">
            <Col className="gap-3">
              <Row className="justify-between items-start">
                <Col className="gap-1">
                  <h4 className="font-medium text-gray-900">{project.title}</h4>
                  <p className="text-sm text-gray-600">{project.description}</p>
                </Col>
                <span className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  project.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                )}>
                  {project.status}
                </span>
              </Row>
              <Row className="justify-between text-sm">
                <span className="text-gray-600">
                  {formatMoney(project.raised)} raised of {formatMoney(project.fundingGoal)} goal
                </span>
                <span className="font-medium">
                  {((project.raised / project.fundingGoal) * 100).toFixed(0)}% funded
                </span>
              </Row>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(project.raised / project.fundingGoal) * 100}%` }}
                />
              </div>
            </Col>
          </Card>
        ))}
      </Col>
    </Col>
  )
}