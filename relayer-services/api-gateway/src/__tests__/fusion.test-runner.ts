/**
 * Fusion+ Test Runner
 * 
 * Comprehensive test suite runner for all Fusion+ integration tests
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

interface TestSuite {
  name: string;
  file: string;
  description: string;
  category: 'unit' | 'integration' | 'contract';
  priority: 'high' | 'medium' | 'low';
}

const testSuites: TestSuite[] = [
  {
    name: 'Fusion+ Routes Unit Tests',
    file: 'src/routes/__tests__/oneinch.fusion.test.ts',
    description: 'Tests individual API endpoints with mocked services',
    category: 'unit',
    priority: 'high'
  },
  {
    name: 'End-to-End Integration Tests',
    file: 'src/__tests__/fusion.integration.test.ts',
    description: 'Tests complete workflows from quote to execution',
    category: 'integration',
    priority: 'high'
  },
  {
    name: 'Contract Integration Tests',
    file: 'src/__tests__/contract.integration.test.ts',
    description: 'Validates contract addresses and parameter formats',
    category: 'contract',
    priority: 'medium'
  },
  {
    name: 'Existing Comprehensive Tests',
    file: 'src/__tests__/comprehensive.test.ts',
    description: 'Legacy comprehensive API structure tests',
    category: 'unit',
    priority: 'low'
  }
];

class FusionTestRunner {
  private results: Map<string, { passed: boolean; duration: number; output: string }> = new Map();

  async runAllTests(): Promise<void> {
    console.log(chalk.blue.bold('\n🧪 Starting Fusion+ Test Suite\n'));
    console.log(chalk.gray('=' .repeat(60)));

    // Group tests by priority
    const highPriorityTests = testSuites.filter(test => test.priority === 'high');
    const mediumPriorityTests = testSuites.filter(test => test.priority === 'medium');
    const lowPriorityTests = testSuites.filter(test => test.priority === 'low');

    // Run high priority tests first
    console.log(chalk.yellow.bold('\n🔥 High Priority Tests (Core Fusion+ Integration)'));
    for (const test of highPriorityTests) {
      await this.runTest(test);
    }

    // Run medium priority tests
    console.log(chalk.yellow.bold('\n⚡ Medium Priority Tests (Contract Validation)'));
    for (const test of mediumPriorityTests) {
      await this.runTest(test);
    }

    // Run low priority tests
    console.log(chalk.yellow.bold('\n📝 Low Priority Tests (Legacy & Documentation)'));
    for (const test of lowPriorityTests) {
      await this.runTest(test);
    }

    this.printSummary();
  }

  private async runTest(test: TestSuite): Promise<void> {
    const startTime = Date.now();
    
    console.log(chalk.cyan(`\n  📋 ${test.name}`));
    console.log(chalk.gray(`     ${test.description}`));
    
    try {
      const output = execSync(`npx jest ${test.file} --verbose`, {
        encoding: 'utf8',
        timeout: 30000
      });
      
      const duration = Date.now() - startTime;
      this.results.set(test.name, { passed: true, duration, output });
      
      console.log(chalk.green(`     ✅ PASSED (${duration}ms)`));
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.set(test.name, { passed: false, duration, output: error.stdout || error.message });
      
      console.log(chalk.red(`     ❌ FAILED (${duration}ms)`));
      console.log(chalk.red(`     Error: ${error.message.split('\n')[0]}`));
    }
  }

  private printSummary(): void {
    console.log(chalk.blue.bold('\n📊 Test Results Summary'));
    console.log(chalk.gray('=' .repeat(60)));

    const passed = Array.from(this.results.values()).filter(r => r.passed).length;
    const total = this.results.size;
    const totalTime = Array.from(this.results.values()).reduce((sum, r) => sum + r.duration, 0);

    console.log(chalk.green(`✅ Passed: ${passed}/${total} test suites`));
    console.log(chalk.gray(`⏱️  Total time: ${totalTime}ms`));
    
    if (passed === total) {
      console.log(chalk.green.bold('\n🎉 All Fusion+ tests passed! Ready for production.'));
      console.log(chalk.green('Your API is now fully integrated with the deployed Fusion+ contracts.'));
    } else {
      console.log(chalk.red.bold('\n⚠️  Some tests failed. Review the errors above.'));
      
      // Show failed tests
      this.results.forEach((result, name) => {
        if (!result.passed) {
          console.log(chalk.red(`\n❌ ${name}:`));
          console.log(chalk.gray(result.output.split('\n').slice(0, 5).join('\n')));
        }
      });
    }

    console.log(chalk.blue.bold('\n🚀 Next Steps:'));
    console.log(chalk.white('1. Fix any failing tests'));
    console.log(chalk.white('2. Run integration tests with live Sepolia contracts'));
    console.log(chalk.white('3. Test with real wallet connections'));
    console.log(chalk.white('4. Deploy to production environment'));
  }

  async runSpecificCategory(category: 'unit' | 'integration' | 'contract'): Promise<void> {
    console.log(chalk.blue.bold(`\n🧪 Running ${category.toUpperCase()} Tests Only\n`));
    
    const testsToRun = testSuites.filter(test => test.category === category);
    
    for (const test of testsToRun) {
      await this.runTest(test);
    }
    
    this.printSummary();
  }
}

// CLI interface
const runner = new FusionTestRunner();

const command = process.argv[2];
switch (command) {
  case 'unit':
    runner.runSpecificCategory('unit');
    break;
  case 'integration':
    runner.runSpecificCategory('integration');
    break;
  case 'contract':
    runner.runSpecificCategory('contract');
    break;
  default:
    runner.runAllTests();
}

export { FusionTestRunner };