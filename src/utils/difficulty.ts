export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate', 
  ADVANCED = 'advanced'
}

export interface DifficultySettings {
  ageRange: string
  description: string
  alphabet: {
    letters: string[]
    includeUppercase: boolean
    includeLowercase: boolean
  }
  math: {
    maxNumber: number
    includeAddition: boolean
    includeSubtraction: boolean
    maxSum: number
  }
}

export const difficultySettings: Record<DifficultyLevel, DifficultySettings> = {
  [DifficultyLevel.BEGINNER]: {
    ageRange: '3-4 år',
    description: 'Grundlæggende bogstaver og tal',
    alphabet: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      includeUppercase: true,
      includeLowercase: false
    },
    math: {
      maxNumber: 10,
      includeAddition: false,
      includeSubtraction: false,
      maxSum: 5
    }
  },
  [DifficultyLevel.INTERMEDIATE]: {
    ageRange: '4-6 år',
    description: 'Flere bogstaver og simpel regning',
    alphabet: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
      includeUppercase: true,
      includeLowercase: true
    },
    math: {
      maxNumber: 50,
      includeAddition: true,
      includeSubtraction: false,
      maxSum: 10
    }
  },
  [DifficultyLevel.ADVANCED]: {
    ageRange: '6-7 år',
    description: 'Alle bogstaver og avanceret regning',
    alphabet: {
      letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'],
      includeUppercase: true,
      includeLowercase: true
    },
    math: {
      maxNumber: 100,
      includeAddition: true,
      includeSubtraction: true,
      maxSum: 20
    }
  }
}

export class DifficultyManager {
  private currentLevel: DifficultyLevel = DifficultyLevel.BEGINNER

  setLevel(level: DifficultyLevel) {
    this.currentLevel = level
    localStorage.setItem('difficultyLevel', level)
  }

  getCurrentLevel(): DifficultyLevel {
    const saved = localStorage.getItem('difficultyLevel')
    if (saved && Object.values(DifficultyLevel).includes(saved as DifficultyLevel)) {
      this.currentLevel = saved as DifficultyLevel
    }
    return this.currentLevel
  }

  getCurrentSettings(): DifficultySettings {
    return difficultySettings[this.getCurrentLevel()]
  }

  getAvailableLetters(): string[] {
    const settings = this.getCurrentSettings()
    let letters = [...settings.alphabet.letters]
    
    if (settings.alphabet.includeLowercase) {
      letters = letters.concat(letters.map(letter => letter.toLowerCase()))
    }
    
    return letters
  }

  getRandomLetter(): string {
    const letters = this.getAvailableLetters()
    return letters[Math.floor(Math.random() * letters.length)]
  }

  getRandomNumber(): number {
    const settings = this.getCurrentSettings()
    return Math.floor(Math.random() * settings.math.maxNumber) + 1
  }

  generateMathProblem(): { num1: number; num2: number; operation: '+' | '-'; answer: number } {
    const settings = this.getCurrentSettings()
    
    if (settings.math.includeAddition && settings.math.includeSubtraction) {
      const operation = Math.random() > 0.5 ? '+' : '-'
      if (operation === '+') {
        const num1 = Math.floor(Math.random() * (settings.math.maxSum / 2)) + 1
        const num2 = Math.floor(Math.random() * (settings.math.maxSum - num1)) + 1
        return { num1, num2, operation, answer: num1 + num2 }
      } else {
        const answer = Math.floor(Math.random() * settings.math.maxSum) + 1
        const num2 = Math.floor(Math.random() * answer) + 1
        const num1 = answer + num2
        return { num1, num2, operation, answer }
      }
    } else if (settings.math.includeAddition) {
      const num1 = Math.floor(Math.random() * (settings.math.maxSum / 2)) + 1
      const num2 = Math.floor(Math.random() * (settings.math.maxSum - num1)) + 1
      return { num1, num2, operation: '+', answer: num1 + num2 }
    } else {
      const num1 = this.getRandomNumber()
      const num2 = 0
      return { num1, num2, operation: '+', answer: num1 }
    }
  }
}

export const difficultyManager = new DifficultyManager()