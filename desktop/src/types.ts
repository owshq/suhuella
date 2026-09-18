export type RecommendationModel = 'rules' | 'onnx'

export type AppSettings = {
  favouriteFolders: string[]
  firstRunCompleted: boolean
  launchAtLogin: boolean
  welcomeNotificationShown: boolean
  recommendationModel: RecommendationModel
}

export type AppInfo = {
  name: string
  version: string
}

export type RecommendedFolder = {
  folder: string
  score: number
  label: string
}

export type SuggestionPayload = {
  fileName: string
  sourceApp: string
  currentFolder: string
  recommendations: RecommendedFolder[]
}

export type RecommendationInput = {
  fileName: string
  sourceApp: string
  favouriteFolders: string[]
  recentFolders?: string[]
  frequentFolders?: Record<string, number>
}
