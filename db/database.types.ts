export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '10.2.0 (e07807d)'
  }
  public: {
    Tables: {
      bids: {
        Row: {
          amount: number
          bidder: string
          created_at: string
          id: string
          project: string
          status: Database['public']['Enums']['bid_status']
          type: Database['public']['Enums']['bid_type']
          valuation: number
        }
        Insert: {
          amount: number
          bidder: string
          created_at?: string
          id?: string
          project: string
          status?: Database['public']['Enums']['bid_status']
          type?: Database['public']['Enums']['bid_type']
          valuation: number
        }
        Update: {
          amount?: number
          bidder?: string
          created_at?: string
          id?: string
          project?: string
          status?: Database['public']['Enums']['bid_status']
          type?: Database['public']['Enums']['bid_type']
          valuation?: number
        }
        Relationships: [
          {
            foreignKeyName: 'bids_bidder_fkey'
            columns: ['bidder']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bids_project_fkey'
            columns: ['project']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      causes: {
        Row: {
          cert_params: Json | null
          description: Json | null
          fund_id: string | null
          header_image_url: string
          open: boolean
          prize: boolean
          project_description_outline: string | null
          slug: string
          sort: number
          subtitle: string | null
          title: string
        }
        Insert: {
          cert_params?: Json | null
          description?: Json | null
          fund_id?: string | null
          header_image_url: string
          open?: boolean
          prize?: boolean
          project_description_outline?: string | null
          slug: string
          sort?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          cert_params?: Json | null
          description?: Json | null
          fund_id?: string | null
          header_image_url?: string
          open?: boolean
          prize?: boolean
          project_description_outline?: string | null
          slug?: string
          sort?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'causes_fund_id_fkey'
            columns: ['fund_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      comment_rxns: {
        Row: {
          comment_id: string
          reaction: string
          reactor_id: string
          txn_id: string | null
        }
        Insert: {
          comment_id: string
          reaction: string
          reactor_id: string
          txn_id?: string | null
        }
        Update: {
          comment_id?: string
          reaction?: string
          reactor_id?: string
          txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'comment_rxns_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comment_rxns_reactor_id_fkey'
            columns: ['reactor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comment_rxns_txn_id_fkey'
            columns: ['txn_id']
            isOneToOne: false
            referencedRelation: 'txns'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          commenter: string
          content: Json | null
          created_at: string
          id: string
          project: string
          replying_to: string | null
          special_type: Database['public']['Enums']['comment_type'] | null
        }
        Insert: {
          commenter: string
          content?: Json | null
          created_at?: string
          id?: string
          project: string
          replying_to?: string | null
          special_type?: Database['public']['Enums']['comment_type'] | null
        }
        Update: {
          commenter?: string
          content?: Json | null
          created_at?: string
          id?: string
          project?: string
          replying_to?: string | null
          special_type?: Database['public']['Enums']['comment_type'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'comments_commenter_fkey'
            columns: ['commenter']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_project_fkey'
            columns: ['project']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_replying_to_fkey'
            columns: ['replying_to']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
        ]
      }
      grant_agreement_private: {
        Row: {
          created_at: string
          determination_letter_on_file: boolean
          foreign_withholding_flag: boolean
          project_id: string
          signatory_email: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          signing_token_hash: string | null
          token_expires_at: string | null
          token_sent_at: string | null
          token_sent_to: string | null
          updated_at: string
          w8_received_at: string | null
          w9_received_at: string | null
        }
        Insert: {
          created_at?: string
          determination_letter_on_file?: boolean
          foreign_withholding_flag?: boolean
          project_id: string
          signatory_email?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          signing_token_hash?: string | null
          token_expires_at?: string | null
          token_sent_at?: string | null
          token_sent_to?: string | null
          updated_at?: string
          w8_received_at?: string | null
          w9_received_at?: string | null
        }
        Update: {
          created_at?: string
          determination_letter_on_file?: boolean
          foreign_withholding_flag?: boolean
          project_id?: string
          signatory_email?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          signing_token_hash?: string | null
          token_expires_at?: string | null
          token_sent_at?: string | null
          token_sent_to?: string | null
          updated_at?: string
          w8_received_at?: string | null
          w9_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'grant_agreement_private_project_id_fkey'
            columns: ['project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      grant_agreements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          foreign_no_tin: boolean
          lobbying_clause_excluded: boolean
          org_agreement_version: number | null
          project_description: Json | null
          project_id: string
          project_title: string | null
          recipient_address: string | null
          recipient_country: string | null
          recipient_entity_class: string | null
          recipient_name: string | null
          recipient_tax_id: string | null
          recipient_type: string
          rendered_document: string | null
          signatory_authority_attested: boolean
          signatory_name: string | null
          signed_at: string | null
          signed_off_site: boolean
          version: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          foreign_no_tin?: boolean
          lobbying_clause_excluded?: boolean
          org_agreement_version?: number | null
          project_description?: Json | null
          project_id: string
          project_title?: string | null
          recipient_address?: string | null
          recipient_country?: string | null
          recipient_entity_class?: string | null
          recipient_name?: string | null
          recipient_tax_id?: string | null
          recipient_type?: string
          rendered_document?: string | null
          signatory_authority_attested?: boolean
          signatory_name?: string | null
          signed_at?: string | null
          signed_off_site?: boolean
          version?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          foreign_no_tin?: boolean
          lobbying_clause_excluded?: boolean
          org_agreement_version?: number | null
          project_description?: Json | null
          project_id?: string
          project_title?: string | null
          recipient_address?: string | null
          recipient_country?: string | null
          recipient_entity_class?: string | null
          recipient_name?: string | null
          recipient_tax_id?: string | null
          recipient_type?: string
          rendered_document?: string | null
          signatory_authority_attested?: boolean
          signatory_name?: string | null
          signed_at?: string | null
          signed_off_site?: boolean
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'grant_agreements_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grant_agreements_project_id_fkey'
            columns: ['project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      orgs: {
        Row: {
          budget_url: string | null
          created_at: string | null
          description: string | null
          donation_url: string | null
          email: string | null
          headcount: number | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          subtitle: string | null
          tags: string[] | null
          target_2026: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          budget_url?: string | null
          created_at?: string | null
          description?: string | null
          donation_url?: string | null
          email?: string | null
          headcount?: number | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          subtitle?: string | null
          tags?: string[] | null
          target_2026?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          budget_url?: string | null
          created_at?: string | null
          description?: string | null
          donation_url?: string | null
          email?: string | null
          headcount?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          subtitle?: string | null
          tags?: string[] | null
          target_2026?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      profile_roles: {
        Row: {
          donor: boolean
          id: string
          insider: boolean
          organizer: string | null
          scholar: string | null
          senior: string | null
          volunteer: string | null
          worker: string | null
        }
        Insert: {
          donor?: boolean
          id: string
          insider?: boolean
          organizer?: string | null
          scholar?: string | null
          senior?: string | null
          volunteer?: string | null
          worker?: string | null
        }
        Update: {
          donor?: boolean
          id?: string
          insider?: boolean
          organizer?: string | null
          scholar?: string | null
          senior?: string | null
          volunteer?: string | null
          worker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profile_roles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profile_trust: {
        Row: {
          created_at: string
          trusted_id: string
          truster_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          trusted_id: string
          truster_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          trusted_id?: string
          truster_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: 'profile_trust_trusted_id_fkey'
            columns: ['trusted_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profile_trust_truster_id_fkey'
            columns: ['truster_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          accreditation_status: boolean
          avatar_url: string | null
          bio: string
          created_at: string
          full_name: string
          id: string
          long_description: Json | null
          mercury_recipient_id: string | null
          regranter_status: boolean
          stripe_connect_id: string | null
          type: Database['public']['Enums']['profile_type']
          username: string
          website: string | null
          id_text: string | null
        }
        Insert: {
          accreditation_status?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          full_name?: string
          id?: string
          long_description?: Json | null
          mercury_recipient_id?: string | null
          regranter_status?: boolean
          stripe_connect_id?: string | null
          type?: Database['public']['Enums']['profile_type']
          username: string
          website?: string | null
        }
        Update: {
          accreditation_status?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          full_name?: string
          id?: string
          long_description?: Json | null
          mercury_recipient_id?: string | null
          regranter_status?: boolean
          stripe_connect_id?: string | null
          type?: Database['public']['Enums']['profile_type']
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      project_causes: {
        Row: {
          application_stage: Database['public']['Enums']['project_stage'] | null
          cause_slug: string
          project_id: string
        }
        Insert: {
          application_stage?: Database['public']['Enums']['project_stage'] | null
          cause_slug: string
          project_id: string
        }
        Update: {
          application_stage?: Database['public']['Enums']['project_stage'] | null
          cause_slug?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_causes_cause_slug_fkey'
            columns: ['cause_slug']
            isOneToOne: false
            referencedRelation: 'causes'
            referencedColumns: ['slug']
          },
          {
            foreignKeyName: 'project_causes_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_embeddings: {
        Row: {
          created_at: string | null
          embedding: string
          id: string
          model_dimension: number
          model_name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding: string
          id?: string
          model_dimension?: number
          model_name?: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string
          id?: string
          model_dimension?: number
          model_name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'project_embeddings_project_id_fkey'
            columns: ['project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_evals: {
        Row: {
          confidence: number
          created_at: string
          evaluator_id: string
          id: string
          project_id: string
          score: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          evaluator_id: string
          id?: string
          project_id: string
          score?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          evaluator_id?: string
          id?: string
          project_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: 'project_evals_evaluator_id_fkey'
            columns: ['evaluator_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_evals_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_follows: {
        Row: {
          follower_id: string
          project_id: string
        }
        Insert: {
          follower_id?: string
          project_id: string
        }
        Update: {
          follower_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_follows_follower_id_fkey'
            columns: ['follower_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_follows_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_scores: {
        Row: {
          content_hash: string | null
          is_spam: boolean | null
          pangram_fraction_ai: number | null
          pangram_fraction_ai_assisted: number | null
          pangram_raw: Json | null
          project_id: string
          quality_raw: Json | null
          quality_score: number | null
          scored_at: string
          spam_reason: string | null
        }
        Insert: {
          content_hash?: string | null
          is_spam?: boolean | null
          pangram_fraction_ai?: number | null
          pangram_fraction_ai_assisted?: number | null
          pangram_raw?: Json | null
          project_id: string
          quality_raw?: Json | null
          quality_score?: number | null
          scored_at?: string
          spam_reason?: string | null
        }
        Update: {
          content_hash?: string | null
          is_spam?: boolean | null
          pangram_fraction_ai?: number | null
          pangram_fraction_ai_assisted?: number | null
          pangram_raw?: Json | null
          project_id?: string
          quality_raw?: Json | null
          quality_score?: number | null
          scored_at?: string
          spam_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'project_scores_project_id_fkey'
            columns: ['project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_transfers: {
        Row: {
          created_at: string
          id: string
          project_id: string
          recipient_email: string
          recipient_name: string
          transferred: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          recipient_email: string
          recipient_name?: string
          transferred?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          recipient_email?: string
          recipient_name?: string
          transferred?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'project_transfers_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_votes: {
        Row: {
          id: number
          magnitude: number
          project_id: string
          voter_id: string
        }
        Insert: {
          id?: number
          magnitude?: number
          project_id: string
          voter_id: string
        }
        Update: {
          id?: number
          magnitude?: number
          project_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_votes_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_votes_voter_id_fkey'
            columns: ['voter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          ai_fraction: number | null
          alerts_paused: boolean
          amm_shares: number | null
          approved: boolean | null
          auction_close: string | null
          blurb: string | null
          created_at: string
          creator: string
          description: Json | null
          external_link: string | null
          founder_shares: number
          funding_goal: number
          id: string
          lobbying: boolean
          location_description: string | null
          markets: Json | null
          min_funding: number
          public_benefit: string | null
          quality_score: number | null
          round: string
          signed_agreement: boolean
          slug: string
          stage: Database['public']['Enums']['project_stage']
          title: string
          type: Database['public']['Enums']['project_type']
        }
        Insert: {
          ai_fraction?: number | null
          alerts_paused?: boolean
          amm_shares?: number | null
          approved?: boolean | null
          auction_close?: string | null
          blurb?: string | null
          created_at?: string
          creator: string
          description?: Json | null
          external_link?: string | null
          founder_shares: number
          funding_goal?: number
          id?: string
          lobbying?: boolean
          location_description?: string | null
          markets?: Json | null
          min_funding: number
          public_benefit?: string | null
          quality_score?: number | null
          round: string
          signed_agreement?: boolean
          slug?: string
          stage?: Database['public']['Enums']['project_stage']
          title?: string
          type?: Database['public']['Enums']['project_type']
        }
        Update: {
          ai_fraction?: number | null
          alerts_paused?: boolean
          amm_shares?: number | null
          approved?: boolean | null
          auction_close?: string | null
          blurb?: string | null
          created_at?: string
          creator?: string
          description?: Json | null
          external_link?: string | null
          founder_shares?: number
          funding_goal?: number
          id?: string
          lobbying?: boolean
          location_description?: string | null
          markets?: Json | null
          min_funding?: number
          public_benefit?: string | null
          quality_score?: number | null
          round?: string
          signed_agreement?: boolean
          slug?: string
          stage?: Database['public']['Enums']['project_stage']
          title?: string
          type?: Database['public']['Enums']['project_type']
        }
        Relationships: [
          {
            foreignKeyName: 'projects_creator_fkey'
            columns: ['creator']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_round_fkey'
            columns: ['round']
            isOneToOne: false
            referencedRelation: 'rounds'
            referencedColumns: ['title']
          },
        ]
      }
      rounds: {
        Row: {
          auction_close_date: string | null
          description: Json | null
          eval_date: string | null
          header_image_url: string | null
          proposal_due_date: string | null
          retro_pool: number | null
          slug: string
          subtitle: string | null
          title: string
        }
        Insert: {
          auction_close_date?: string | null
          description?: Json | null
          eval_date?: string | null
          header_image_url?: string | null
          proposal_due_date?: string | null
          retro_pool?: number | null
          slug: string
          subtitle?: string | null
          title: string
        }
        Update: {
          auction_close_date?: string | null
          description?: Json | null
          eval_date?: string | null
          header_image_url?: string | null
          proposal_due_date?: string | null
          retro_pool?: number | null
          slug?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      stripe_txns: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          session_id: string
          txn_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          session_id: string
          txn_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          session_id?: string
          txn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stripe_txns_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stripe_txns_txn_id_fkey'
            columns: ['txn_id']
            isOneToOne: false
            referencedRelation: 'txns'
            referencedColumns: ['id']
          },
        ]
      }
      txns: {
        Row: {
          amount: number
          bundle: string | null
          created_at: string
          from_id: string | null
          id: string
          project: string | null
          to_id: string
          token: string
          type: Database['public']['Enums']['txn_type'] | null
        }
        Insert: {
          amount: number
          bundle?: string | null
          created_at?: string
          from_id?: string | null
          id?: string
          project?: string | null
          to_id: string
          token: string
          type?: Database['public']['Enums']['txn_type'] | null
        }
        Update: {
          amount?: number
          bundle?: string | null
          created_at?: string
          from_id?: string | null
          id?: string
          project?: string | null
          to_id?: string
          token?: string
          type?: Database['public']['Enums']['txn_type'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'txns_from_id_fkey'
            columns: ['from_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'txns_project_fkey'
            columns: ['project']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'txns_to_id_fkey'
            columns: ['to_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          failure_reason: string | null
          feedback: string | null
          id: string
          idempotency_key: string
          last_nudged_at: string | null
          mercury_invite_id: string | null
          mercury_onboarding_url: string | null
          mercury_recipient_id: string | null
          mercury_request_id: string | null
          mercury_transaction_id: string | null
          payment_method: string
          profile_id: string
          requested_at: string
          sent_at: string | null
          status: string
          submitted_at: string | null
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          failure_reason?: string | null
          feedback?: string | null
          id?: string
          idempotency_key?: string
          last_nudged_at?: string | null
          mercury_invite_id?: string | null
          mercury_onboarding_url?: string | null
          mercury_recipient_id?: string | null
          mercury_request_id?: string | null
          mercury_transaction_id?: string | null
          payment_method: string
          profile_id: string
          requested_at?: string
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          failure_reason?: string | null
          feedback?: string | null
          id?: string
          idempotency_key?: string
          last_nudged_at?: string | null
          mercury_invite_id?: string | null
          mercury_onboarding_url?: string | null
          mercury_recipient_id?: string | null
          mercury_request_id?: string | null
          mercury_transaction_id?: string | null
          payment_method?: string
          profile_id?: string
          requested_at?: string
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'withdrawal_requests_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'withdrawal_requests_txn_id_fkey'
            columns: ['txn_id']
            isOneToOne: false
            referencedRelation: 'txns'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      users: {
        Row: {
          email: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _transfer_project:
        | {
            Args: {
              amount: number
              from_id: string
              project_id: string
              to_id: string
              transfer_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              amount: number
              donor_comment_id?: string
              from_id: string
              project_id: string
              to_id: string
              transfer_id: string
              txn_id: string
            }
            Returns: undefined
          }
        | {
            Args: { project_id: string; to_id: string; transfer_id: string }
            Returns: undefined
          }
      activate_cert: {
        Args: { project_creator: string; project_id: string }
        Returns: undefined
      }
      activate_grant: {
        Args: { project_creator: string; project_id: string }
        Returns: undefined
      }
      add_tags: { Args: never; Returns: undefined }
      add_topics: { Args: never; Returns: undefined }
      create_transfer_grant: {
        Args: {
          donor_comment: Database['public']['CompositeTypes']['comment_row']
          grant_amount: number
          project: Database['public']['CompositeTypes']['project_row']
          project_transfer: Database['public']['CompositeTypes']['transfer_row']
        }
        Returns: undefined
      }
      execute_grant_verdict:
        | {
            Args: {
              admin_comment_content?: Json
              admin_id?: string
              approved: boolean
              project_creator: string
              project_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              admin_comment_content?: Json
              admin_id?: string
              approved: boolean
              project_creator: string
              project_id: string
              public_benefit?: string
            }
            Returns: undefined
          }
      execute_readonly_sql: {
        Args: { max_rows?: number; query: string }
        Returns: Json
      }
      find_similar_projects: {
        Args: { match_count?: number; project_id: string }
        Returns: {
          blurb: string
          id: string
          similarity: number
          slug: string
          title: string
        }[]
      }
      follow_project: {
        Args: { follower_id: string; project_id: string }
        Returns: undefined
      }
      give_grant: {
        Args: {
          donation: Database['public']['CompositeTypes']['bid_row']
          donor_comment: Database['public']['CompositeTypes']['comment_row']
          project: Database['public']['CompositeTypes']['project_row']
        }
        Returns: undefined
      }
      id_text: {
        Args: { '': Database['public']['Tables']['profiles']['Row'] }
        Returns: {
          error: true
        } & 'the function public.id_text with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      }
      reject_grant: { Args: { project_id: string }; Returns: undefined }
      reject_proposal: { Args: { project_id: string }; Returns: undefined }
      search_projects_by_embedding: {
        Args: {
          include_hidden?: boolean
          match_count?: number
          query_embedding: string
        }
        Returns: {
          blurb: string
          id: string
          similarity: number
          slug: string
          stage: Database['public']['Enums']['project_stage']
          title: string
        }[]
      }
      toggle_follow: {
        Args: { follower_id: string; project_id: string }
        Returns: undefined
      }
      transfer_project:
        | {
            Args: {
              amount: number
              from_id: string
              project_id: string
              to_id: string
              transfer_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              amount: number
              donor_comment_id: string
              from_id: string
              project_id: string
              to_id: string
              transfer_id: string
              txn_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              amount: number
              donor_notes: Json
              from_id: string
              project_id: string
              to_id: string
              transfer_id: string
            }
            Returns: undefined
          }
      unfollow_project: {
        Args: { follower_id: string; project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bid_status: 'deleted' | 'pending' | 'accepted' | 'declined'
      bid_type: 'buy' | 'sell' | 'donate' | 'assurance buy' | 'assurance sell'
      comment_type: 'progress update' | 'final report'
      profile_type: 'individual' | 'org' | 'fund' | 'amm'
      project_stage: 'active' | 'proposal' | 'not funded' | 'complete' | 'hidden' | 'draft'
      project_type: 'grant' | 'cert' | 'dummy'
      txn_type:
        | 'profile donation'
        | 'project donation'
        | 'user to user trade'
        | 'user to amm trade'
        | 'withdraw'
        | 'deposit'
        | 'cash to charity transfer'
        | 'inject amm liquidity'
        | 'mint cert'
        | 'mana deposit'
        | 'tip'
        | 'return bank funds'
    }
    CompositeTypes: {
      bid_row: {
        project: string | null
        amount: number | null
        bidder: string | null
      }
      comment_row: {
        id: string | null
        project: string | null
        commenter: string | null
        content: Json | null
      }
      comment_row_txnless: {
        id: string | null
        project: string | null
        commenter: string | null
        content: Json | null
      }
      project_row: {
        id: string | null
        creator: string | null
        title: string | null
        blurb: string | null
        description: Json | null
        min_funding: number | null
        funding_goal: number | null
        founder_shares: number | null
        type: Database['public']['Enums']['project_type'] | null
        stage: Database['public']['Enums']['project_stage'] | null
        round: string | null
        slug: string | null
        location_description: string | null
        lobbying: boolean | null
      }
      transfer_row: {
        recipient_email: string | null
        recipient_name: string | null
        project_id: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bid_status: ['deleted', 'pending', 'accepted', 'declined'],
      bid_type: ['buy', 'sell', 'donate', 'assurance buy', 'assurance sell'],
      comment_type: ['progress update', 'final report'],
      profile_type: ['individual', 'org', 'fund', 'amm'],
      project_stage: ['active', 'proposal', 'not funded', 'complete', 'hidden', 'draft'],
      project_type: ['grant', 'cert', 'dummy'],
      txn_type: [
        'profile donation',
        'project donation',
        'user to user trade',
        'user to amm trade',
        'withdraw',
        'deposit',
        'cash to charity transfer',
        'inject amm liquidity',
        'mint cert',
        'mana deposit',
        'tip',
        'return bank funds',
      ],
    },
  },
} as const
