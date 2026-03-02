"""
Trust Mode Comparison Test
Compares balanced vs strict mode across three scenarios
"""
from app.services.meta_evaluator import MetaEvaluator

# Test scenarios
scenarios = {
    'Clean': {
        'metrics': {'accuracy': 0.92, 'f1_score': 0.90},
        'dataset_stats': {'n_rows': 5000, 'n_features': 15, 'missing_values': 10, 'imbalance_ratio': 0.55, 'duplicate_ratio': 0.01, 'skew_score': 0.05},
        'fairness': {'analysis_successful': True, 'fairness_metrics': {'demographic_parity_difference': 0.05}}
    },
    'Moderate': {
        'metrics': {'accuracy': 0.85, 'f1_score': 0.82},
        'dataset_stats': {'n_rows': 1000, 'n_features': 20, 'missing_values': 150, 'imbalance_ratio': 0.75, 'duplicate_ratio': 0.10, 'skew_score': 0.40},
        'fairness': {'analysis_successful': True, 'fairness_metrics': {'demographic_parity_difference': 0.25}}
    },
    'Severe': {
        'metrics': {'accuracy': 0.75, 'f1_score': 0.70},
        'dataset_stats': {'n_rows': 500, 'n_features': 50, 'missing_values': 300, 'imbalance_ratio': 0.92, 'duplicate_ratio': 0.25, 'skew_score': 0.75},
        'fairness': {'analysis_successful': True, 'fairness_metrics': {'demographic_parity_difference': 0.50}}
    }
}

print('=' * 80)
print('TRUST MODE COMPARISON: Balanced vs Strict')
print('=' * 80)
print(f'{"Scenario":<12} | {"Balanced":>10} | {"Strict":>10} | {"Delta":>8} | {"DII_B":>8} | {"DII_S":>8} | Guard B | Guard S')
print('-' * 80)

for name, data in scenarios.items():
    balanced = MetaEvaluator(trust_mode='balanced')
    strict = MetaEvaluator(trust_mode='strict')
    
    rb = balanced.evaluate(metrics=data['metrics'], dataset_stats=data['dataset_stats'], model_type='classification', fairness_result=data['fairness'])
    rs = strict.evaluate(metrics=data['metrics'], dataset_stats=data['dataset_stats'], model_type='classification', fairness_result=data['fairness'])
    
    delta = rs['trust_score'] - rb['trust_score']
    gb = 'YES' if rb['non_compensatory_override'] else 'no'
    gs = 'YES' if rs['non_compensatory_override'] else 'no'
    
    print(f'{name:<12} | {rb["trust_score"]:>10.2f} | {rs["trust_score"]:>10.2f} | {delta:>+8.2f} | {rb["DII"]:>8.4f} | {rs["DII"]:>8.4f} | {gb:>7} | {gs:>7}')

print('=' * 80)
print()
print('DETAILED BREAKDOWN (Severe Scenario):')
print('-' * 40)
print(f'  Balanced DII Formula: additive')
print(f'  Strict DII Formula: multiplicative')
print()

# Run severe scenario again for detailed output
balanced = MetaEvaluator(trust_mode='balanced')
strict = MetaEvaluator(trust_mode='strict')

rb = balanced.evaluate(
    metrics=scenarios['Severe']['metrics'], 
    dataset_stats=scenarios['Severe']['dataset_stats'], 
    model_type='classification', 
    fairness_result=scenarios['Severe']['fairness']
)
rs = strict.evaluate(
    metrics=scenarios['Severe']['metrics'], 
    dataset_stats=scenarios['Severe']['dataset_stats'], 
    model_type='classification', 
    fairness_result=scenarios['Severe']['fairness']
)

print(f'  Component Scores:')
print(f'    P (Performance): {rb["component_scores"]["performance"]:.4f}')
print(f'    H (Health):      B={rb["component_scores"]["health"]:.4f}, S={rs["component_scores"]["health"]:.4f}')
print(f'    F (Fairness):    {rb["component_scores"]["fairness"]:.4f}')
print(f'    R (Robustness):  {rb["component_scores"]["robustness"]:.4f}')
print()
print(f'  Risk Values (Balanced): r_P={rb["risk_values"]["r_P"]:.4f}, r_H={rb["risk_values"]["r_H"]:.4f}, r_F={rb["risk_values"]["r_F"]:.4f}, r_R={rb["risk_values"]["r_R"]:.4f}')
print(f'  Risk Values (Strict):   r_P={rs["risk_values"]["r_P"]:.4f}, r_H={rs["risk_values"]["r_H"]:.4f}, r_F={rs["risk_values"]["r_F"]:.4f}, r_R={rs["risk_values"]["r_R"]:.4f}')
print()
print(f'  Lambda:')
print(f'    Balanced: {rb["lambda_value"]:.4f} (raw={rb["lambda_raw"]:.4f})')
print(f'    Strict:   {rs["lambda_value"]:.4f} (raw={rs["lambda_raw"]:.4f})')
print()
print(f'  Global Penalty (Strict only):')
print(f'    Applied: {rs["global_penalty_applied"]}')
print(f'    Raw Score: {rs["trust_score_raw"]:.2f} -> Final: {rs["trust_score"]:.2f}')
print()
print(f'  Guard Threshold:')
print(f'    Balanced: {rb["guard_threshold"]:.2f}')
print(f'    Strict:   {rs["guard_threshold"]:.2f}')
print()
print('=' * 80)
print('Strict mode demonstrates faster trust collapse under instability.')
