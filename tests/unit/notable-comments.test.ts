import { describe, expect, test } from 'bun:test'
import { notableCommentScore, ScorableComment } from '@/utils/notable-comments'

const comment = (over: Partial<ScorableComment> = {}): ScorableComment => ({
  commenter: 'author',
  commenterKarma: 1,
  replyingTo: null,
  specialType: null,
  textLength: 200,
  reactions: [],
  ...over,
})
const react = (reactorKarma: number, reaction = '🔥', reactorId = 'r1', tipped = false) => ({
  reactorId,
  reactorKarma,
  reaction,
  tipped,
})

describe('C36 notable comments in the weekly digest', () => {
  test('an unreacted comment needs an author with karma 100', () => {
    expect(notableCommentScore(comment({ commenterKarma: 100 }))).toBeCloseTo(1)
    expect(notableCommentScore(comment({ commenterKarma: 99 }))).toBeNull()
  })
  test('one positive reaction from someone with karma 10 is enough', () => {
    expect(notableCommentScore(comment({ reactions: [react(10)] }))).toBeCloseTo(1)
  })
  test('reactions count by the reactor’s karma, tips multiply, and only positive ones count', () => {
    expect(notableCommentScore(comment({ reactions: [react(1000)] }))).toBeCloseTo(3)
    expect(notableCommentScore(comment({ reactions: [react(100, '🏆', 'r1', true)] }))).toBeCloseTo(
      10
    )
    expect(notableCommentScore(comment({ reactions: [react(1000, '🤔')] }))).toBeNull()
  })
  test('reacting to your own comment doesn’t count', () => {
    expect(notableCommentScore(comment({ reactions: [react(1000, '🔥', 'author')] }))).toBeNull()
  })
  test('short unreacted comments, replies and admin notes are left out', () => {
    expect(notableCommentScore(comment({ commenterKarma: 5000, textLength: 99 }))).toBeNull()
    expect(notableCommentScore(comment({ commenterKarma: 5000, replyingTo: 'c1' }))).toBeNull()
    expect(
      notableCommentScore(comment({ commenterKarma: 5000, specialType: 'admin note' }))
    ).toBeNull()
  })
  test('creators’ progress updates qualify like any comment', () => {
    expect(
      notableCommentScore(comment({ commenterKarma: 200, specialType: 'progress update' }))
    ).not.toBeNull()
  })
})
